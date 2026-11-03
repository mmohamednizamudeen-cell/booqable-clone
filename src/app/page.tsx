import { redirect } from "next/navigation";

// Until the back office exists, the root shows the design system.
export default function Home() {
  redirect("/design");
}
