import { demoRoutes } from "./demo-routes";

export function DemoHub() {
  return (
    <main className="DemoHub">
      <header className="HubMasthead">
        <div className="HubIdentity">
          <strong>Focusgrid</strong>
          <span>Keyboard-native pane layouts for React</span>
        </div>
        <a
          className="GithubButton"
          href="https://github.com/andrewcyuan/focusgrid"
          rel="noreferrer"
          target="_blank"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
          >
            <path
              fill="currentColor"
              d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.04 1.77 2.71 1.26 3.37.97.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18a10.98 10.98 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"
            />
          </svg>
          View on GitHub
        </a>
      </header>

      <section className="HubCatalogue" aria-labelledby="hub-title">
        <header className="HubIntro">
          <h1 id="hub-title">Demos</h1>
          <p>
            Focused examples of pane layout, shortcut routing, and
            application-managed focus.
          </p>
        </header>

        <nav aria-label="Focusgrid demos">
          <ul className="DemoList">
            {demoRoutes.map((route) => (
              <li key={route.path}>
                <a className="DemoListRow" href={route.path}>
                  <strong>{route.title}</strong>
                  <span>{route.path}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <footer className="HubFooter">
        <strong>Focusgrid</strong>
        <span>MIT licensed</span>
        <span>React · Ariakit · Shortcut Engine</span>
      </footer>
    </main>
  );
}
