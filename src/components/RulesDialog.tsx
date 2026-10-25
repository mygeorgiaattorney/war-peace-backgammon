import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import "./game-info.css";

export type RulesDialogProps = {
  open: boolean;
  onClose: () => void;
};

const tabs = ["Overview", "Core Rules", "Strategy"] as const;
type RulesTab = (typeof tabs)[number];

export default function RulesDialog({ open, onClose }: RulesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [tab, setTab] = useState<RulesTab>("Overview");
  const id = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    const previousFocus = document.activeElement as HTMLElement | null;
    setTab("Overview");
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (current + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next]);
    tabRefs.current[next]?.focus();
  }

  function containFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled):not([tabindex="-1"]), [tabindex="0"]',
      ) ?? [],
    ).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      className="wp-rules-dialog"
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      onKeyDown={containFocus}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="wp-rules-shell">
        <header className="wp-rules-header">
          <div>
            <p className="wp-eyebrow">War &amp; Peace Backgammon</p>
            <h2 id={`${id}-title`}>How to play</h2>
          </div>
          <button className="wp-close-button" type="button" onClick={onClose} ref={closeRef} aria-label="Close rules">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="wp-rules-tabs" role="tablist" aria-label="Rules sections">
          {tabs.map((label, index) => (
            <button
              key={label}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel-${index}`}
              aria-selected={tab === label}
              tabIndex={tab === label ? 0 : -1}
              ref={(element) => { tabRefs.current[index] = element; }}
              onClick={() => setTab(label)}
              onKeyDown={(event) => moveTab(event, index)}
            >
              {label}
            </button>
          ))}
        </div>
        {tabs.map((label, index) => (
          <section
            key={label}
            className="wp-rules-content"
            role="tabpanel"
            id={`${id}-panel-${index}`}
            aria-labelledby={`${id}-tab-${index}`}
            tabIndex={0}
            hidden={tab !== label}
          >
            {label === "Overview" && <Overview />}
            {label === "Core Rules" && <CoreRules />}
            {label === "Strategy" && <Strategy />}
          </section>
        ))}
        <footer className="wp-rules-footer">
          <span>You can reopen these rules during a game.</span>
          <button type="button" className="wp-gold-button" onClick={onClose}>Got it</button>
        </footer>
      </div>
    </dialog>
  );
}

function Overview() {
  return (
    <>
      <p className="wp-rules-lead">Bear off all 15 of your checkers to win. The twist is how you get there.</p>
      <div className="wp-rules-mode-grid">
        <article className="wp-rule-card">
          <span className="wp-mode-label wp-mode-war">WAR</span>
          <h3>Attack is compulsory.</h3>
          <p>Among the legal ways to use your dice, take the route that captures the most opposing checkers.</p>
        </article>
        <article className="wp-rule-card">
          <span className="wp-mode-label wp-mode-peace">PEACE</span>
          <h3>Keep the peace.</h3>
          <p>Avoid captures when possible. If a hit is unavoidable, your opponent takes over your remaining moves.</p>
        </article>
      </div>
      <div className="wp-rule-callout">
        <h3>Doubles can change everything.</h3>
        <p>Playable doubles switch WAR to PEACE, or PEACE to WAR. If there is no legal move, the mode stays the same and the turn passes.</p>
      </div>
      <h3>Your first game</h3>
      <p>Choose an opponent, roll the opening dice, then follow the turn prompt. Select one of your checkers and a highlighted destination. You can also drag a checker to a legal destination.</p>
    </>
  );
}

function CoreRules() {
  return (
    <ol className="wp-rule-list">
      <li>
        <h3>The opening</h3>
        <p>Each player rolls one die. Ties are rerolled. The higher roller chooses WAR or PEACE and plays first using those two opening dice.</p>
      </li>
      <li>
        <h3>Use your dice</h3>
        <p>Use as many dice as legally possible. If only one of two different dice can be used and either is playable, use the higher die. Doubles provide four moves of the same value.</p>
      </li>
      <li>
        <h3>Blocked points and prisoners</h3>
        <p>You cannot land on two or more opposing checkers. Landing on a lone opponent captures it and sends it to the bar—a Prisoner of War or Prisoner of Peace. Your checkers on the bar must re-enter before you move any others.</p>
      </li>
      <li>
        <h3>WAR and PEACE priorities</h3>
        <p>After the dice-use rules, WAR requires the most captures; PEACE requires the fewest. A no-hit play must be used if one is available. Among plays satisfying that priority, bear off as many checkers as possible.</p>
      </li>
      <li>
        <h3>Enemy Control</h3>
        <p>An unavoidable PEACE capture gives your opponent control of your checkers for the rest of that turn. They choose the remaining legal moves using your unused dice. WAR/PEACE priorities are suspended, but ordinary movement and dice-use rules still apply. There is no extra roll.</p>
      </li>
      <li>
        <h3>Doubles and blocked turns</h3>
        <p>Playable doubles switch the mode before you move. Completely blocked doubles do not. A turn with no legal move passes automatically.</p>
      </li>
      <li>
        <h3>Bearing off and winning</h3>
        <p>Bring all your remaining checkers into your home board before bearing off. Use an exact die, or a larger die only when no checker sits farther from the exit. The first player to bear off all 15 wins.</p>
      </li>
    </ol>
  );
}

function Strategy() {
  return (
    <div className="wp-strategy-list">
      <article>
        <span className="wp-strategy-number" aria-hidden="true">01</span>
        <div>
          <h3>Set a PEACE land mine</h3>
          <p>A deliberately exposed checker can become a trap if your opponent’s roll forces a capture. You then choose their remaining moves. Exposure alone is not enough: a legal no-hit play lets them avoid the trap.</p>
        </div>
      </article>
      <article>
        <span className="wp-strategy-number" aria-hidden="true">02</span>
        <div>
          <h3>Plan for both modes</h3>
          <p>Playable doubles can turn a PEACE trap into a WAR target. Check which single checkers are exposed and which points you can secure with two or more checkers.</p>
        </div>
      </article>
      <article>
        <span className="wp-strategy-number" aria-hidden="true">03</span>
        <div>
          <h3>Make Enemy Control count</h3>
          <p>When you control your opponent’s checkers, look for legal moves that break up their defenses or leave them exposed. You use only the dice left in that turn.</p>
        </div>
      </article>
      <article>
        <span className="wp-strategy-number" aria-hidden="true">04</span>
        <div>
          <h3>Look beyond the pip count</h3>
          <p>A racing lead matters, but so do blocked points, prisoners, and the current mode. A PEACE violation can open a comeback; it does not guarantee one.</p>
        </div>
      </article>
    </div>
  );
}
