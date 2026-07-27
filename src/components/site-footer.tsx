import { Link } from "@tanstack/react-router";
import { Mail, Phone, MapPin } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[image:var(--gradient-soft)] mt-12">
      <div className="mx-auto max-w-7xl px-6 py-16 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link to="/" aria-label="Tusome Live home" className="flex items-center">
            <BrandLogo imageClassName="h-16" />
          </Link>
          <p className="mt-4 text-muted-foreground max-w-sm">
            Live online CBE tuition for Kenyan learners in Grades 7, 8 & 9. Quality teaching,
            anywhere in the country.
          </p>
          <div className="mt-5 space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> Tusomelive@gmail
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" /> +254 700 000 000
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Nairobi, Kenya
            </p>
          </div>
        </div>
        <div>
          <p className="font-semibold mb-4">Learn</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/classes" className="hover:text-foreground">
                Classes
              </Link>
            </li>
            <li>
              <Link to="/tutors" className="hover:text-foreground">
                Tutors
              </Link>
            </li>
            <li>
              <Link to="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mb-4">Company</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/about" className="hover:text-foreground">
                About us
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/signup" className="hover:text-foreground">
                Become a tutor
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-muted-foreground flex flex-wrap justify-between gap-3">
          <p>© {new Date().getFullYear()} Tusome Live. All rights reserved.</p>
          <p>Quality CBE learning, for every Kenyan home.</p>
        </div>
      </div>
    </footer>
  );
}
