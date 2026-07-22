import { AriakitPlayground } from "./AriakitPlayground";
import { EmailPlayground } from "./EmailPlayground";
import { DemoHub } from "./DemoHub";
import { TmuxPlayground } from "./TmuxPlayground";

export function App() {
  switch (window.location.pathname) {
    case "/tmux":
      return <TmuxPlayground />;
    case "/ariakit":
      return <AriakitPlayground />;
    case "/email":
      return <EmailPlayground />;
    default:
      return <DemoHub />;
  }
}
