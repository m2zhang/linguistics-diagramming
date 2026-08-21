import { useOutletContext } from 'react-router-dom';
import { AssignmentDetailInstructor } from './AssignmentDetailInstructor';
import { AssignmentDetailStudent } from './AssignmentDetailStudent';
import type { CourseOutletContext } from './CourseShell';

export function AssignmentDetail() {
  const { course, role } = useOutletContext<CourseOutletContext>();
  return role === 'instructor' ? (
    <AssignmentDetailInstructor courseId={course.id} />
  ) : (
    <AssignmentDetailStudent courseId={course.id} />
  );
}
