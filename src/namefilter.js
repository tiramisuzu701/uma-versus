// Display-name filter: blocks slurs and swear words in account names.
// The same list and rules run on the server (supabase/004_name_filter.sql, made by tools/make_name_filter_sql.py),
// so this copy only gives a friendly message before sign-up; the database has the final say.
'use strict';

// Names are compared after cleaning (lower case, leet digits swapped, separators dropped), both as typed and with
// stretched letters collapsed, so 5h1t, f.u_c-k and fuuuck are caught too.
//   S: blocked anywhere in the name
//   E: blocked at the start or end of a word (catches "bullshit" but not "Yoshitaka")
//   X: blocked only as a whole word (catches "ass" but not "Glass", "Assassin", "Grape" or "Team Spica")
const NAME_BLOCK = {
  S: ['fuck', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'bitch', 'slut', 'tranny', 'hitler', 'pedophil', 'molest',
    'porn', 'penis', 'vagina', 'pussy', 'dildo', 'rapist', 'asshole', 'bastard', 'motherf', 'killyourself', 'milf', 'hentai',
    'cumshot', 'blowjob', 'cocksuck'],
  E: ['shit', 'dick', 'nazi', 'twat', 'jizz', 'kike', 'chink', 'dyke', 'fag', 'piss', 'tits', 'boob'],
  X: ['ass', 'cum', 'tit', 'hoe', 'sex', 'negro', 'kys', 'nig', 'jap', 'gook', 'kkk', 'cock', 'rape', 'pedo', 'wank', 'spic', 'coon'],
};
const NAME_LEET = { 0: 'o', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g' };
// lower-case, swap leet digits (1 is tried as both i and l), keep letters only
function nameClean(s, one) { return s.toLowerCase().replace(/[0-9]/g, d => d === '1' ? one : NAME_LEET[d] || '').replace(/[^a-z]/g, ''); }
const nameCollapse = s => s.replace(/(.)\1+/g, '$1');
// words in a name: split on spaces _ . - and on camelCase (BigAssRunner -> Big Ass Runner)
function nameWords(s) { return s.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[ _.\-]+/).filter(Boolean); }
function nameBlocked(name) {
  const Sc = NAME_BLOCK.S.map(nameCollapse);
  for (const one of ['i', 'l']) {
    const whole = nameClean(name, one);
    if (NAME_BLOCK.S.some(w => whole.includes(w)) || Sc.some(w => nameCollapse(whole).includes(w))) return true;
    // each word, plus the whole name (so s h i t spelled out is still one word)
    for (const t0 of [...nameWords(name).map(w => nameClean(w, one)), whole]) for (const t of [t0, nameCollapse(t0)]) {
      if (NAME_BLOCK.E.some(w => t.startsWith(w) || t.endsWith(w))) return true;
      if (NAME_BLOCK.X.some(w => t === w || t === w + 's')) return true;
    }
  }
  return false;
}
