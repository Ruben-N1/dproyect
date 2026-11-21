class MezclaEscape extends AudioWorkletProcessor {
  process([music, exhaust], [output]) {
    for (const [index, channel] of output.entries()) {
      const song = music[index] ?? music[0];
      const effect = exhaust[index] ?? exhaust[0];

      if (!effect) {
        if (song) channel.set(song);
        continue;
      }

      for (let sample = 0; sample < channel.length; sample++) {
        const base = song?.[sample] ?? 0;
        const direction = Math.sign(effect[sample]);
        const available = Math.max(0, 1 - direction * base);
        const level = Math.abs(effect[sample]);
        const knee = available * .7;

        // Limita solo el escape; conserva intacta la música.
        const remaining = available - knee;
        const excess = level - knee;
        const limited = excess > 0 ? knee + remaining * excess / (remaining + excess) : level;
        channel[sample] = base + direction * limited;
      }
    }
    return true;
  }
}

registerProcessor('mezcla-escape', MezclaEscape);
