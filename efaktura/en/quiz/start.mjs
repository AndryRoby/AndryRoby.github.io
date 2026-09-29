// start.mjs: starts the English quiz on /efaktura/en/quiz/ (shared UI and logic live in /efaktura/kviz/).
import { spusti } from '/efaktura/kviz/ui.mjs?v=2';
import texts from './texts.mjs?v=2';

spusti(texts);
