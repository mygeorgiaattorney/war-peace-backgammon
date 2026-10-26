import "./dice-panel.css";

export type RollHistoryEntry = {
  id: number;
  player: "White" | "Black";
  dice: [number, number];
  opening: boolean;
};

type Props = {
  dice: number[];
  used: number[];
  selected: number | null;
  selectable: boolean;
  playableValues: number[];
  rolling: boolean;
  opening: boolean;
  history: RollHistoryEntry[];
  owner: (value: number, index: number) => "White" | "Black";
  onSelect: (index: number) => void;
};

const spots: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const pips = (value: number) => Array.from({ length: 9 }, (_, spot) => <span key={spot} className={spots[value]?.includes(spot) ? "die-pip" : ""} />);

export default function DicePanel(props: Props) {
  const previous = props.history.slice(0, -1).slice(-5).reverse();
  return <div className={"dice-panel" + (props.dice.length > 2 ? " has-doubles" : "")}>
    <span className="console-label">{props.opening ? "OPENING ROLL" : "CURRENT ROLL"}</span>
    <div className={"dice-row " + (props.rolling ? "dice-rolling" : "")} data-testid="dice">
      {props.dice.length ? props.dice.map((value, index) => {
        const used = props.used.includes(index);
        return <button key={index} type="button"
          className={"game-die " + (props.owner(value, index) === "White" ? "die-light" : "die-dark") + (used ? " die-used" : "")}
          data-used={used} data-die-index={index} data-die-value={value}
          aria-label={`Die ${value}, ${used ? "used" : `available, position ${index + 1}`}`}
          aria-pressed={props.selected === index}
          disabled={used || !props.selectable || !props.playableValues.includes(value)}
          title={used ? "Already used this turn" : `Use ${value} — either die may go first`}
          onClick={() => props.onSelect(index)}>{pips(value)}</button>;
      }) : <><span className="die-empty">·</span><span className="die-empty">·</span></>}
    </div>
    {props.dice.length > 0 && !props.opening && <p className="dice-help">
      {props.used.length === props.dice.length ? "Roll complete" : props.selected === null ? "Either die first" : `Using ${props.dice[props.selected]} · tap again for either`}
    </p>}
    {previous.length > 0 && <section className="roll-history" aria-label="Previous five rolls, newest first" title="Newest roll first" data-testid="roll-history">
      <span className="console-label">PREVIOUS ROLLS</span>
      <ol>{previous.map(roll => <li key={roll.id} aria-label={`${roll.opening ? "Opening" : roll.player} rolled ${roll.dice[0]} and ${roll.dice[1]}`}>
        <span className="roll-history-player"><span className="history-player-full">{roll.opening ? "Opening" : roll.player}</span><span className="history-player-short" aria-hidden="true">{roll.opening ? "O" : roll.player[0]}</span></span>
        <span className="roll-history-pair" aria-hidden="true">{roll.dice.map((value, index) =>
          <span key={index} className={"history-die " + ((roll.opening ? index === 0 : roll.player === "White") ? "die-light" : "die-dark")}>{pips(value)}</span>
        )}</span>
      </li>)}</ol>
    </section>}
  </div>;
}
