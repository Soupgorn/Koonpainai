import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main id="main" className="main-container">
      <div className="empty-state page-empty">
        <MapPin size={35} strokeWidth={1.4} />
        <h1>A little off the timetable.</h1>
        <p>This page is unavailable. Head back to find your friends.</p>
        <Button asChild>
          <Link href="/">
            <ArrowLeft size={15} />
            Back to friends
          </Link>
        </Button>
      </div>
    </main>
  );
}
