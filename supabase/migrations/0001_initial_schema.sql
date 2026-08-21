-- SyntaxTree — initial Supabase schema
--
-- Ported from the previous Express + node-pg-migrate backend. Differences that
-- matter, all forced by moving authorization from Express middleware into the
-- database (the browser now talks to Postgres directly):
--
--   * `users` is gone. Supabase owns identities in auth.users; `profiles` holds
--     our columns (display_name, role) and is filled by a trigger on signup.
--     password_hash / reset_token / the whole `session` table are Supabase's
--     job now and are not recreated here.
--   * Join codes moved OUT of `courses` into `course_join_codes`. RLS grants
--     table-level, not column-level, access — a policy letting students read
--     their course would have handed them the enrolment code too. Staff-only
--     policy on the side table preserves that boundary.
--   * Every ownsX()/canReadX() Express helper is now an RLS policy backed by a
--     SECURITY DEFINER function. They must be SECURITY DEFINER: a policy on
--     `enrollments` that itself queries `enrollments` recurses infinitely.
--
-- Run this whole file once in the Supabase SQL Editor.

-- ---------------------------------------------------------------- extensions
create extension if not exists citext;
create extension if not exists pgcrypto;

-- --------------------------------------------------------------------- enums
create type public.user_role       as enum ('student', 'instructor');
create type public.course_role     as enum ('student', 'ta');
create type public.assignment_mode as enum ('blank', 'template');

-- ------------------------------------------------------------------ profiles
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        citext not null,
  display_name text not null,
  role         public.user_role not null default 'student',
  created_at   timestamptz not null default now()
);

-- Signup writes display_name/role into user metadata; mirror it into profiles
-- so the app can read it with a normal query and RLS can key off it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'student')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------- courses
create table public.courses (
  id            uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  title         text not null,
  description   text,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index idx_courses_instructor on public.courses(instructor_id);

-- Separate table purely so students can never read the code (see header note).
create table public.course_join_codes (
  course_id uuid primary key references public.courses(id) on delete cascade,
  code      text unique not null
);

create table public.enrollments (
  course_id  uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  role       public.course_role not null default 'student',
  created_at timestamptz not null default now(),
  primary key (course_id, student_id)
);
create index idx_enrollments_student on public.enrollments(student_id);

create table public.course_preferences (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  color      text not null,
  favorite   boolean not null default false,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
create index idx_course_preferences_user on public.course_preferences(user_id);

-- ------------------------------------------------------------------ lectures
create table public.lectures (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  title      text not null,
  notes      text,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_lectures_course on public.lectures(course_id, position);

create table public.lecture_trees (
  id         uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  title      text not null,
  content    jsonb not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_lecture_trees_lecture on public.lecture_trees(lecture_id, position);

-- --------------------------------------------------------------- assignments
create table public.assignments (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references public.courses(id) on delete cascade,
  lecture_id       uuid references public.lectures(id) on delete set null,
  title            text not null,
  instructions     text,
  mode             public.assignment_mode not null,
  template_content jsonb,
  due_at           timestamptz,
  max_grade        numeric(5,2),
  created_at       timestamptz not null default now(),
  constraint template_requires_content
    check (mode <> 'template' or template_content is not null)
);
create index idx_assignments_course  on public.assignments(course_id, due_at);
create index idx_assignments_lecture on public.assignments(lecture_id);

-- ----------------------------------------------------------------- materials
-- storage_path replaces the old on-disk stored_name: files now live in the
-- `materials` Storage bucket instead of server/uploads/.
create table public.materials (
  id            uuid primary key default gen_random_uuid(),
  lecture_id    uuid references public.lectures(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  uploaded_by   uuid not null references public.profiles(id) on delete restrict,
  original_name text not null,
  storage_path  text not null unique,
  mime_type     text not null,
  size_bytes    bigint not null,
  created_at    timestamptz not null default now(),
  constraint materials_one_owner check (num_nonnulls(lecture_id, assignment_id) = 1)
);
create index idx_materials_lecture    on public.materials(lecture_id);
create index idx_materials_assignment on public.materials(assignment_id);

-- ------------------------------------------------------ drafts & submissions
create table public.drafts (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  content       jsonb not null,
  updated_at    timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  content       jsonb not null,
  submitted_at  timestamptz not null default now(),
  grade         numeric(5,2),
  feedback      text,
  graded_at     timestamptz,
  graded_by     uuid references public.profiles(id) on delete set null
);
create index idx_submissions_assignment on public.submissions(assignment_id);
create index idx_submissions_student    on public.submissions(student_id);

-- ============================================================================
-- Authorization helpers (SECURITY DEFINER — see header note on recursion)
-- ============================================================================

create or replace function public.is_course_staff(p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from courses c
                  where c.id = p_course and c.instructor_id = auth.uid())
      or exists (select 1 from enrollments e
                  where e.course_id = p_course and e.student_id = auth.uid()
                    and e.role = 'ta');
$$;

create or replace function public.is_course_member(p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from courses c
                  where c.id = p_course and c.instructor_id = auth.uid())
      or exists (select 1 from enrollments e
                  where e.course_id = p_course and e.student_id = auth.uid());
$$;

create or replace function public.course_of_lecture(p_lecture uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select course_id from lectures where id = p_lecture;
$$;

create or replace function public.course_of_assignment(p_assignment uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select course_id from assignments where id = p_assignment;
$$;

-- You may read a profile if it is yours, or you share a course with them.
create or replace function public.shares_course_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from courses c where
         (c.instructor_id = auth.uid()
          and exists (select 1 from enrollments e where e.course_id = c.id and e.student_id = p_user))
      or (c.instructor_id = p_user
          and exists (select 1 from enrollments e where e.course_id = c.id and e.student_id = auth.uid()))
      or (exists (select 1 from enrollments a where a.course_id = c.id and a.student_id = auth.uid())
          and exists (select 1 from enrollments b where b.course_id = c.id and b.student_id = p_user))
  );
$$;

-- ============================================================================
-- Join codes
-- ============================================================================

-- Unambiguous alphabet: no 0/O/1/I/L, matching the old server/src/lib/joinCode.ts.
create or replace function public.generate_join_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text;
begin
  loop
    result := '';
    for _i in 1..6 loop
      result := result || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from course_join_codes where code = result);
  end loop;
  return result;
end $$;

create or replace function public.random_course_color()
returns text language sql volatile as $$
  select (array['red','orange','amber','green','teal','blue','indigo','purple','pink'])
         [floor(random() * 9)::int + 1];
$$;

-- A new course gets its join code and the instructor's own colour preference
-- automatically, so the client never has to do a second write.
create or replace function public.on_course_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into course_join_codes (course_id, code) values (new.id, generate_join_code());
  insert into course_preferences (user_id, course_id, color)
  values (new.instructor_id, new.id, random_course_color())
  on conflict do nothing;
  return new;
end $$;

create trigger course_created
  after insert on public.courses
  for each row execute function public.on_course_created();

-- Enrolling has to bypass RLS: the student cannot SELECT the course yet, and
-- must never be able to read course_join_codes. SECURITY DEFINER contains that
-- privilege to exactly this operation.
create or replace function public.join_course(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
begin
  select c.id into v_course
    from courses c
    join course_join_codes j on j.course_id = c.id
   where j.code = upper(trim(p_code))
     and c.archived = false;

  if v_course is null then
    raise exception 'invalid join code' using errcode = 'P0002';
  end if;

  insert into enrollments (course_id, student_id)
  values (v_course, auth.uid())
  on conflict (course_id, student_id) do nothing;   -- idempotent; keeps a TA's role

  insert into course_preferences (user_id, course_id, color)
  values (auth.uid(), v_course, random_course_color())
  on conflict do nothing;

  return v_course;
end $$;

create or replace function public.regenerate_join_code(p_course uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not is_course_staff(p_course) then
    raise exception 'not your course' using errcode = '42501';
  end if;
  v_code := generate_join_code();
  update course_join_codes set code = v_code where course_id = p_course;
  return v_code;
end $$;

-- A submission's content is immutable once submitted; grading may only touch
-- grade/feedback. RLS is table-level, so this guard lives in a trigger.
create or replace function public.submissions_content_immutable()
returns trigger language plpgsql as $$
begin
  if new.content is distinct from old.content
     or new.student_id is distinct from old.student_id
     or new.assignment_id is distinct from old.assignment_id then
    raise exception 'submission content is immutable';
  end if;
  return new;
end $$;

create trigger submissions_no_content_edit
  before update on public.submissions
  for each row execute function public.submissions_content_immutable();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles           enable row level security;
alter table public.courses            enable row level security;
alter table public.course_join_codes  enable row level security;
alter table public.enrollments        enable row level security;
alter table public.course_preferences enable row level security;
alter table public.lectures           enable row level security;
alter table public.lecture_trees      enable row level security;
alter table public.assignments        enable row level security;
alter table public.materials          enable row level security;
alter table public.drafts             enable row level security;
alter table public.submissions        enable row level security;

-- profiles ------------------------------------------------------------------
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or shares_course_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- courses -------------------------------------------------------------------
create policy courses_read on public.courses for select to authenticated
  using (is_course_member(id));
create policy courses_insert on public.courses for insert to authenticated
  with check (
    instructor_id = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'instructor')
  );
create policy courses_update on public.courses for update to authenticated
  using (is_course_staff(id)) with check (is_course_staff(id));
create policy courses_delete on public.courses for delete to authenticated
  using (instructor_id = auth.uid());

-- course_join_codes: staff only, and never written directly by a client ------
create policy join_codes_read on public.course_join_codes for select to authenticated
  using (is_course_staff(course_id));

-- enrollments ---------------------------------------------------------------
create policy enrollments_read on public.enrollments for select to authenticated
  using (student_id = auth.uid() or is_course_staff(course_id));
create policy enrollments_update_role on public.enrollments for update to authenticated
  using (is_course_staff(course_id)) with check (is_course_staff(course_id));
create policy enrollments_delete on public.enrollments for delete to authenticated
  using (student_id = auth.uid() or is_course_staff(course_id));
-- (no INSERT policy: enrolling goes through join_course())

-- course_preferences --------------------------------------------------------
create policy prefs_all on public.course_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- lectures ------------------------------------------------------------------
create policy lectures_read on public.lectures for select to authenticated
  using (is_course_member(course_id));
create policy lectures_write on public.lectures for all to authenticated
  using (is_course_staff(course_id)) with check (is_course_staff(course_id));

create policy lecture_trees_read on public.lecture_trees for select to authenticated
  using (is_course_member(course_of_lecture(lecture_id)));
create policy lecture_trees_write on public.lecture_trees for all to authenticated
  using (is_course_staff(course_of_lecture(lecture_id)))
  with check (is_course_staff(course_of_lecture(lecture_id)));

-- assignments ---------------------------------------------------------------
create policy assignments_read on public.assignments for select to authenticated
  using (is_course_member(course_id));
create policy assignments_write on public.assignments for all to authenticated
  using (is_course_staff(course_id)) with check (is_course_staff(course_id));

-- materials -----------------------------------------------------------------
create policy materials_read on public.materials for select to authenticated
  using (
    (lecture_id    is not null and is_course_member(course_of_lecture(lecture_id)))
    or (assignment_id is not null and is_course_member(course_of_assignment(assignment_id)))
  );
create policy materials_write on public.materials for all to authenticated
  using (
    (lecture_id    is not null and is_course_staff(course_of_lecture(lecture_id)))
    or (assignment_id is not null and is_course_staff(course_of_assignment(assignment_id)))
  )
  with check (
    uploaded_by = auth.uid()
    and (
      (lecture_id    is not null and is_course_staff(course_of_lecture(lecture_id)))
      or (assignment_id is not null and is_course_staff(course_of_assignment(assignment_id)))
    )
  );

-- drafts: strictly the student's own working copy ---------------------------
create policy drafts_own on public.drafts for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid()
              and is_course_member(course_of_assignment(assignment_id)));

-- submissions ---------------------------------------------------------------
create policy submissions_read on public.submissions for select to authenticated
  using (student_id = auth.uid() or is_course_staff(course_of_assignment(assignment_id)));
create policy submissions_insert on public.submissions for insert to authenticated
  with check (student_id = auth.uid()
              and is_course_member(course_of_assignment(assignment_id)));
-- Grading only; the trigger above blocks content edits.
create policy submissions_grade on public.submissions for update to authenticated
  using (is_course_staff(course_of_assignment(assignment_id)))
  with check (is_course_staff(course_of_assignment(assignment_id)));

-- ============================================================================
-- Storage: lecture/assignment materials
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

-- Object paths are "<course_id>/<uuid>-<filename>", so the first path segment
-- is the course and drives the same membership checks as the metadata rows.
create policy materials_object_read on storage.objects for select to authenticated
  using (bucket_id = 'materials'
         and is_course_member(((storage.foldername(name))[1])::uuid));

create policy materials_object_write on storage.objects for insert to authenticated
  with check (bucket_id = 'materials'
              and is_course_staff(((storage.foldername(name))[1])::uuid));

create policy materials_object_delete on storage.objects for delete to authenticated
  using (bucket_id = 'materials'
         and is_course_staff(((storage.foldername(name))[1])::uuid));
