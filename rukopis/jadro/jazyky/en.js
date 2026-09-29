// Hand-curated candidate phrases, neither attribution evidence nor calibration.
export default {
  FRAZY: "in today's fast-paced|digital landscape|ever-evolving|take it to the next level|to the next level|game-changer|delve|tapestry|seamless|leverage|unlock the power|navigate the complexities|it's important to note|in the realm of|a testament to|no longer optional|competitive edge|the key is|last-minute|ultimately|remember|investment in your future|in today's world|in this day and age|in an increasingly|rapidly evolving|rapidly changing|in the digital age|digital transformation|unlock your potential|unlock the potential|unleash the power|harness the power|harness the potential|a wealth of|a wide range of|a myriad of|a plethora of|pave the way|paves the way|plays a crucial role|plays a pivotal role|plays a vital role|at the forefront|at the heart of|a cornerstone of|a holistic approach|a comprehensive approach|a robust framework|a powerful tool|a valuable tool|an invaluable tool|cutting-edge|state-of-the-art|best-in-class|world-class|revolutionize the way|transform the way|elevate your|drive growth|drive innovation|foster innovation|foster collaboration|streamline operations|streamline processes|optimize your workflow|maximize efficiency|enhance productivity|ensure success|long-term success|sustainable growth|strategic partnership|strategic advantage|competitive advantage|stay ahead of the curve|stay ahead of the competition|navigate the challenges|embrace the future|embrace change|the future of business|the power of innovation|endless possibilities|boundless possibilities|new opportunities|new heights|embark on a journey|on your journey|in conclusion|to sum up|the bottom line|the key takeaway|at the end of the day|it's worth noting|it is worth noting|it is important to note|let's explore|let's dive in|look no further|whether you're|whether you are|a win-win|moving forward|going forward|in today's competitive".split('|'),
  KONSTRUKCIE: [/\b(it'?s|is) not (just|only|merely) [^.;]{1,40}, (it'?s|but)\b/iu],
  ZAVER: 'in conclusion|ultimately|in the end|to sum up|the key takeaway|at the end of the day|the bottom line'.split('|'),
  MORAL: ["remember", "don't forget", 'never forget'],
  NEISTOTA: ["I don't know", "I'm not sure", 'perhaps', 'maybe', 'probably', 'I was wrong', 'I might be wrong', 'I wonder', 'I failed', 'I cannot tell', 'I suspect'],
  ODBOCKY: ['by the way', 'btw', 'incidentally', 'side note'],
  FUNKCNE: 'the a an and or but if when while of to in on at by for with from as is are was were be been being it this that these those I you he she we they my your our their its not no do does did have has had can could will would should may might so than then there here which who what all some any each only also just into about over under through before after because'.split(' '),
  JA: 'I me my mine we us our ours'.split(' '), TY: 'you your yours'.split(' '),
  PRIPONY: ['tion', 'sion', 'ment', 'ness', 'ity', 'ance', 'ence'],
  VYNIMKY: ['moment', 'comment', 'city', 'since', 'once', 'science', 'audience'],
  SKRATKY: 'e.g.|i.e.|etc.|vs.|Mr.|Mrs.|Ms.|Dr.|Inc.|Ltd.|No.'.split('|'),
  ODPOVED: /^(yes|no|because|the answer is|the reason is)\b/iu,
  VZTAZNE: /,\s*(?:who|which|that)\b[^,]*$/iu,
  SPOJKY: 'and|or', KMEN: 6,
  PRAHY: { M1: [.60,.25], M2: [.60,.20], M3: [.10,.35], M4: [6,1], M5: [1.5,0], M6: [0,1.5], M7: [0,1], M8: [3,7], M9: [0,.8] },
  PASMA: [35,65],
  VAHY: { M1: .15, M2: .05, M3: .20, M4: .15, M5: .10, M6: .15, M7: .05, M8: .10, M9: .05 }
};
