import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import appleTouchIcon from "@/assets/elimusphere-icon.png";
import logoImage from "@/assets/elimusphere-logo.webp";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Elimusphere" },
      {
        name: "description",
        content: "Live CBE classes for Kenyan learners in Grades 7, 8 and 9.",
      },
      { name: "author", content: "Elimusphere" },
      { property: "og:title", content: "Elimusphere" },
      {
        property: "og:description",
        content: "Live CBE classes for Kenyan learners in Grades 7, 8 and 9.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "icon",
        type: "image/webp",
        href: logoImage,
      },
      {
        rel: "apple-touch-icon",
        href: appleTouchIcon,
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      {!pathname.startsWith("/conference/") ? (
        <a
          href="https://wa.me/254712155312"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with Elimusphere on WhatsApp"
          title="Chat with us on WhatsApp"
          className="whatsapp-fab fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 32 32"
            className="whatsapp-fab__icon h-8 w-8 fill-none stroke-current"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 4.25a11.4 11.4 0 0 0-9.72 17.36L4.75 27.25l5.78-1.51A11.4 11.4 0 1 0 16 4.25Z"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12.1 10.65c-.3-.67-.62-.68-.91-.69h-.78c-.27 0-.7.1-1.06.5-.36.4-1.39 1.36-1.39 3.32s1.42 3.85 1.62 4.12c.2.27 2.74 4.4 6.78 5.99 3.35 1.32 4.04 1.06 4.77.99.73-.07 2.35-.96 2.68-1.89.33-.93.33-1.73.23-1.89-.1-.17-.36-.27-.76-.47-.4-.2-2.35-1.16-2.72-1.29-.36-.13-.63-.2-.89.2-.26.4-1.03 1.29-1.26 1.56-.23.27-.46.3-.86.1-.4-.2-1.68-.62-3.2-1.97-1.19-1.06-1.99-2.37-2.22-2.77-.23-.4-.02-.61.18-.81.18-.18.4-.46.6-.69.2-.23.26-.4.4-.66.13-.27.06-.5-.04-.7-.1-.2-.87-2.15-1.19-2.95Z"
              fill="currentColor"
              stroke="none"
            />
          </svg>
        </a>
      ) : null}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
