import React, { useMemo, useState } from 'react';
import { Brain, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import getReferenceCard from '../features/liveDetection/aslReferenceData';

const LESSONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => ({
  letter,
  tip: {
    A: 'Close your fingers into a fist and keep the thumb alongside the hand.',
    B: 'Keep fingers straight together and fold the thumb across the palm.',
    C: 'Curve the hand into a clear C shape.',
    D: 'Point index up while thumb and other fingers touch.',
    E: 'Curl fingertips toward the thumb with a compact palm.',
    F: 'Touch thumb and index, keep the other three fingers lifted.',
    G: 'Point index sideways with thumb parallel.',
    H: 'Extend index and middle together sideways.',
    I: 'Raise only the pinky from a closed fist.',
    L: 'Make a right angle with thumb and index.',
    O: 'Round all fingers into an O shape.',
    V: 'Raise index and middle in a V shape.',
    W: 'Raise index, middle, and ring fingers.',
    Y: 'Extend thumb and pinky while other fingers fold.'
  }[letter] || 'Match the reference card and hold the sign steady in front of the camera.'
}));

export default function LearningMode() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [quizLetter, setQuizLetter] = useState('A');
  const lesson = LESSONS[currentIndex];
  const reference = useMemo(() => getReferenceCard(lesson.letter), [lesson.letter]);
  const progress = Math.round((completed.length / LESSONS.length) * 100);

  const nextLesson = () => {
    setCurrentIndex((index) => (index + 1) % LESSONS.length);
  };

  const markComplete = () => {
    setCompleted((items) => (
      items.includes(lesson.letter) ? items : [...items, lesson.letter]
    ));
    nextLesson();
  };

  const randomQuiz = () => {
    const nextLetter = LESSONS[Math.floor(Math.random() * LESSONS.length)].letter;
    setQuizLetter(nextLetter);
  };

  return (
    <div className="space-y-6 text-slate-100">
      <section className="overflow-hidden rounded-[2rem] border border-[#1fe0b1]/20 bg-[radial-gradient(circle_at_top_left,_rgba(31,224,177,0.18),_transparent_28%),linear-gradient(145deg,#07131c,#0b1720)] p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1fe0b1]/25 bg-[#1fe0b1]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#b9fff1]">
              <Brain size={14} />
              AI Learning Mode
            </div>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-white">Practice ASL alphabet with guided feedback</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              A competition-ready learning layer that pairs reference cards, practice flow, and quick recall drills with the live detector workspace.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Progress</p>
            <p className="mt-1 text-3xl font-black text-[#1fe0b1]">{progress}%</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/10 bg-[#07131c]/92 p-5 shadow-xl">
          <div className="grid gap-5 md:grid-cols-[0.9fr_1fr] md:items-center">
            <img src={reference.image} alt={reference.title} className="w-full rounded-[1.5rem] border border-white/10" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current Lesson</p>
              <h3 className="mt-2 text-7xl font-black text-white">{lesson.letter}</h3>
              <p className="mt-4 text-lg leading-8 text-slate-300">{lesson.tip}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button onClick={markComplete} className="inline-flex items-center gap-2 rounded-2xl bg-[#1fe0b1] px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-[#52e8c1]">
                  <CheckCircle2 size={16} />
                  Mark Practiced
                </button>
                <button onClick={nextLesson} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10">
                  Next Letter
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#07131c]/92 p-5 shadow-xl">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#1fe0b1]" />
            <h3 className="text-xl font-bold text-white">Recall Drill</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Look away from the reference, make the sign, then reveal the card in Live Detection to compare your hand shape.
          </p>
          <div className="mt-5 rounded-[1.5rem] border border-[#1fe0b1]/20 bg-[#1fe0b1]/10 p-6 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-[#b9fff1]">Practice Prompt</p>
            <p className="mt-3 text-8xl font-black text-white">{quizLetter}</p>
          </div>
          <button onClick={randomQuiz} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10">
            <RotateCcw size={16} />
            New Random Letter
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#07131c]/92 p-5 shadow-xl">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Alphabet Progress</p>
        <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-9 md:grid-cols-[repeat(13,minmax(0,1fr))]">
          {LESSONS.map((item, index) => {
            const isDone = completed.includes(item.letter);
            const isActive = index === currentIndex;
            return (
              <button
                key={item.letter}
                onClick={() => setCurrentIndex(index)}
                className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                  isActive
                    ? 'border-[#1fe0b1] bg-[#1fe0b1] text-slate-950'
                    : isDone
                      ? 'border-[#1fe0b1]/25 bg-[#1fe0b1]/10 text-[#b9fff1]'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {item.letter}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
