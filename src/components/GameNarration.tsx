import "./game-narration.css";

export type NarrationEvent = {
  id: number;
  kind: "war-capture" | "peace-capture" | "bear-off" | "landmine";
  title: string;
  detail: string;
  player: "White" | "Black";
};

type Props = { event: NarrationEvent; onDismiss: () => void };

export default function GameNarration({ event, onDismiss }: Props) {
  const peace = event.kind === "peace-capture";
  return (
    <section className={`game-narration narration-${event.kind}`} aria-label="Game narration" data-testid="game-narration">
      <div className="narration-emblem" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none">
          {event.kind === "bear-off" ? <>
            <path d="M15 42h34v12H15zM20 42V29h24v13M32 10v24m-8-16 8-8 8 8" />
            <circle cx="32" cy="42" r="8" />
          </> : event.kind === "landmine" ? <>
            <path d="M10 49h44M18 48l4-11h20l4 11M32 12v22M22 22h20M18 16l-5-5m33 5 5-5" />
            <circle cx="32" cy="29" r="4" />
          </> : <>
            <path d={peace ? "M16 12h32v24c0 10-16 18-16 18s-16-8-16-18z" : "M32 6l6 12 14-4-4 14 10 8-14 4 1 15-13-7-13 7 1-15-14-4 10-8-4-14 14 4z"} />
            {peace ? <path d="m35 17-7 14 10 1-9 17M11 24l-5 4m47-4 5 4" /> : <path d="m23 22 18 20m0-20L23 42" />}
          </>}
        </svg>
        <span className={`narration-checker ${event.player === "White" ? "checker-light" : "checker-dark"}`} />
      </div>
      <div className="narration-copy" role="status" aria-live="polite" aria-atomic="true">
        <span className="narration-eyebrow">{peace ? "THE COST OF PEACE" : event.kind === "landmine" ? "A COMEBACK CHANCE" : event.kind === "bear-off" ? "HOMEWARD" : "ON THE BATTLEFIELD"}</span>
        <strong>{event.title}</strong>
        <p>{event.detail}</p>
      </div>
      <button type="button" className="narration-dismiss" onClick={onDismiss} aria-label="Dismiss game narration">×</button>
    </section>
  );
}
