import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent } from "react";
import "./game-info.css";

export type GameIntroProps = {
  onPlayBalanced: () => void;
  onPlayAggressive: () => void;
  onPlayTwoPlayers: () => void;
  onShowRules: () => void;
  onResume?: () => void;
};

export default function GameIntro({
  onPlayBalanced,
  onPlayAggressive,
  onPlayTwoPlayers,
  onShowRules,
  onResume,
}: GameIntroProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>("[data-primary-action]")?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  function containFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    if (!buttons?.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="wp-intro" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="wp-intro-card" ref={panelRef} onKeyDown={containFocus}>
        <section className="wp-intro-story">
          <div className="wp-brand-mark" aria-hidden="true">
            <span className="wp-brand-checker wp-brand-checker-dark" />
            <span className="wp-brand-checker wp-brand-checker-light" />
          </div>
          <p className="wp-eyebrow">A different kind of backgammon</p>
          <h1 id={titleId} className="wp-intro-title">
            War <span>&amp;</span> Peace
            <small>Backgammon</small>
          </h1>
          <p className="wp-intro-lead">The board is familiar. The balance can change in a roll.</p>

          <div className="wp-doctrines">
            <div>
              <span className="wp-mode-label wp-mode-war">WAR</span>
              <p>Capture when the rules demand it.</p>
            </div>
            <div>
              <span className="wp-mode-label wp-mode-peace">PEACE</span>
              <p>Avoid capture—or surrender control.</p>
            </div>
          </div>
          <p className="wp-intro-description">
            Playable doubles switch the mode. In PEACE, an exposed checker can become a
            land mine: force a capture and take control of your opponent’s remaining
            moves. Plan for the turn that changes everything.
          </p>
          <button className="wp-text-button wp-learn-button" type="button" onClick={onShowRules}>
            How to play <span aria-hidden="true">↗</span>
          </button>
        </section>

        <section className="wp-start-options" aria-labelledby={`${titleId}-choose`}>
          <p className="wp-eyebrow" id={`${titleId}-choose`}>Choose your game</p>
          {onResume && (
            <button
              type="button"
              className="wp-resume-button"
              data-primary-action
              onClick={onResume}
            >
              <span>Continue saved game</span><span aria-hidden="true">→</span>
            </button>
          )}
          <button
            type="button"
            className="wp-game-option wp-game-option-balanced"
            data-primary-action={!onResume || undefined}
            onClick={onPlayBalanced}
          >
            <span className="wp-option-symbol" aria-hidden="true">01</span>
            <span className="wp-option-copy">
              <small>Computer 1</small>
              <strong>Balanced</strong>
              <span>Careful attack and defense.</span>
            </span>
            <span className="wp-option-arrow" aria-hidden="true">→</span>
          </button>
          <button type="button" className="wp-game-option wp-game-option-aggressive" onClick={onPlayAggressive}>
            <span className="wp-option-symbol" aria-hidden="true">02</span>
            <span className="wp-option-copy">
              <small>Computer 2</small>
              <strong>Aggressive</strong>
              <span>Pressure, risk, and comeback chances.</span>
            </span>
            <span className="wp-option-arrow" aria-hidden="true">→</span>
          </button>
          <button type="button" className="wp-game-option" onClick={onPlayTwoPlayers}>
            <span className="wp-option-symbol wp-two-checkers" aria-hidden="true"><i /><i /></span>
            <span className="wp-option-copy">
              <small>Pass &amp; play</small>
              <strong>Two players</strong>
              <span>Two people sharing this screen.</span>
            </span>
            <span className="wp-option-arrow" aria-hidden="true">→</span>
          </button>
          <p className="wp-start-note">Against the computer, you play White.</p>
        </section>
      </div>
    </div>
  );
}
