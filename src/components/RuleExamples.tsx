import { useState } from 'react';
import examples from '../game/rule-lessons.json';
import './rule-examples.css';

type LessonKey = keyof typeof examples;
const choices: LessonKey[] = ['war', 'peace', 'vengeance', 'doubles', 'home'];
const rows = [[12,13,14,15,16,17,18,19,20,21,22,23],[11,10,9,8,7,6,5,4,3,2,1,0]];

export default function RuleExamples() {
  const [lesson, setLesson] = useState<LessonKey>('vengeance');
  const [index, setIndex] = useState(0);
  const data = examples[lesson], state = data.states[index];
  const control = state.controller !== state.player;
  const move = 'preview' in state ? state.preview : 'last' in state ? state.last : null;
  function choose(key: LessonKey) { setLesson(key); setIndex(0); }
  return <div className={'rule-examples example-' + (control ? 'vengeance' : state.mode.toLowerCase())}>
    <nav className="example-choices" aria-label="Illustrated rule lessons">{choices.map(key => <button type="button" key={key} aria-pressed={lesson === key} onClick={() => choose(key)}>{examples[key].label}</button>)}</nav>
    <p>{data.rule}</p>
    <div className="example-heading" aria-live="polite"><h3>{state.heading}</h3><p>{state.detail}</p></div>
    <div className="example-board" role="img" aria-label={`${data.label} illustrated board, step ${index + 1}. ${state.controller} chooses ${state.player}'s moves. White ${state.pips.White} pips; Black ${state.pips.Black} pips.`}>
      {rows.map((row, ri) => row.map((pointIndex, ci) => {
        const point = state.board[pointIndex];
        return <div key={pointIndex} className={'example-point ' + (ri ? 'example-bottom ' : '') + (ci % 2 ? 'example-alt ' : '') + (move?.from === pointIndex ? 'example-from ' : '') + (move?.to === pointIndex ? 'example-to' : '')}
          style={{gridColumn: ci < 6 ? ci + 1 : ci + 2, gridRow: ri + 1}}>
          <span>{pointIndex + 1}</span><div className="example-pile">{Array.from({length: Math.min(point.count, 5)}, (_, n) => <i key={n} className={'example-checker checker-' + (point.owner === 'White' ? 'light' : 'dark')} />)}</div>
        </div>;
      }))}
      <div className="example-bar"><span>White bar<br/>{state.bar.White}</span><span>BAR</span><span>Black bar<br/>{state.bar.Black}</span></div>
    </div>
    <div className="example-caption"><span>{control ? `${state.controller} commands ${state.player}'s checkers` : `${state.player} moves · ${state.mode}`}</span><span>Dice left: {state.dice.join(' · ') || 'none'} · White off {state.off.White} · Black off {state.off.Black}</span></div>
    <div className="example-actions"><button type="button" disabled={index === 0} onClick={() => setIndex(value => value - 1)}>Back</button><button type="button" onClick={() => setIndex(value => (value + 1) % data.states.length)}>{state.action}</button><span>{index + 1} / {data.states.length}</span></div>
    {(lesson === 'doubles' || lesson === 'blocked') && <button type="button" onClick={() => choose(lesson === 'doubles' ? 'blocked' : 'doubles')}>{lesson === 'doubles' ? 'See blocked doubles' : 'See playable doubles'}</button>}
    {(lesson === 'vengeance' || lesson === 'lastdie') && <button type="button" onClick={() => choose(lesson === 'vengeance' ? 'lastdie' : 'vengeance')}>{lesson === 'vengeance' ? 'When the capture uses the last die' : 'See the full control handoff'}</button>}
  </div>;
}
