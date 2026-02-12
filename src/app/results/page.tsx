import { redirect } from 'next/navigation';

/** Results functionality lives on the matching page. Redirect there. */
export default function ResultsPage() {
  redirect('/matching');
}
