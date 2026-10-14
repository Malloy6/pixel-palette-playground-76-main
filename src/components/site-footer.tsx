import { Link } from "@tanstack/react-router";
import { Mail, Phone, MapPin, Sparkles, ArrowUpRight } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[image:var(--gradient-soft)] mt-12">
      <div className="mx-auto max-w-7xl px-6 py-16 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link to="/" aria-label="Elimusphere home" className="flex items-center">
            <BrandLogo imageClassName="h-28 w-28" />
          </Link>
          <p className="mt-4 text-muted-foreground max-w-sm">
            Live online CBE classes for Kenyan learners in Grades 1 - 10. Quality teaching,
            anywhere in the country.
          </p>
          <div className="mt-5 space-y-2 text-sm text-muted-foreground">
            <a
              href="mailto:info@elimusphere.co.ke"
              className="flex items-center gap-2 hover:text-foreground"
            >
              <Mail className="h-4 w-4 text-primary" /> info@elimusphere.co.ke
            </a>
            <a href="tel:+254712155312" className="flex items-center gap-2 hover:text-foreground">
              <Phone className="h-4 w-4 text-primary" /> +254 712 155 312
            </a>
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
              <Link to="/resources" className="hover:text-foreground">
                Resources
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mb-4">Company</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/about" className="hover:text-foreground">
                About Us
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </li>
            <li>
              <a href="/signup?role=tutor" className="hover:text-foreground">
                Become a tutor
              </a>
            </li>
            <li>
              <a href="/legal/privacy-policy" className="hover:text-foreground">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="/legal/terms-of-service" className="hover:text-foreground">
                Terms of Use
              </a>
            </li>
            <li>
              <a href="/legal/cookie-policy" className="hover:text-foreground">
                Cookie Policy
              </a>
            </li>
            <li>
              <a href="/legal/student-agreement" className="hover:text-foreground">
                Student Agreement
              </a>
            </li>
            <li>
              <a href="/legal/teacher-agreement" className="hover:text-foreground">
                Teacher Agreement
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-muted-foreground flex flex-wrap justify-between gap-3">
          <p>© {new Date().getFullYear()} Elimusphere. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p>Fully responsive CBE classes, anytime and anywhere.</p>
            <a
              href="https://buildsbysteve.co.ke"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Website designed and built by Steve — opens in a new tab"
              className="group inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:text-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[image:var(--gradient-hero)] text-white transition-transform duration-300 group-hover:rotate-12">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span>
                Crafted by <span className="font-semibold text-foreground">Steve</span>
              </span>
              <ArrowUpRight
                className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
