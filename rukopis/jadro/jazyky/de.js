// Redaktionelle Kandidatenliste, kein Herkunftsnachweis. Noch nicht kalibriert.
import en from './en.js';
export default {
  ...en,
  FRAZY: 'in der heutigen schnelllebigen|auf die nächste stufe|nahtlos|ein wichtiger aspekt|es ist wichtig zu beachten|spielt eine entscheidende rolle|in der heutigen zeit|in einer sich ständig verändernden welt|im digitalen zeitalter|digitale transformation|digitale landschaft|die zukunft gestalten|die zukunft des unternehmens|neue maßstäbe setzen|maßstäbe setzen|neue möglichkeiten eröffnen|eröffnet neue möglichkeiten|neue chancen nutzen|chancen und herausforderungen|herausforderungen meistern|herausforderungen in chancen verwandeln|potenzial ausschöpfen|das volle potenzial|potenzial entfalten|den weg ebnen|ebnet den weg|der schlüssel zum erfolg|nachhaltiger erfolg|langfristiger erfolg|nachhaltiges wachstum|wachstum fördern|innovation fördern|innovationen vorantreiben|zusammenarbeit fördern|prozesse optimieren|prozesse vereinfachen|effizienz steigern|produktivität steigern|mehrwert schaffen|einen mehrwert bieten|maßgeschneiderte lösungen|innovative lösungen|ganzheitlicher ansatz|umfassender ansatz|strategischer partner|strategische partnerschaft|wettbewerbsvorteil sichern|einen wettbewerbsvorteil|wettbewerbsfähig bleiben|immer einen schritt voraus|am puls der zeit|mit der zeit gehen|mit dem wandel schritt halten|wandel aktiv gestalten|fit für die zukunft|zukunftssicher aufstellen|zukunftsorientierte lösungen|neue höhen erreichen|grenzen überwinden|grenzen verschieben|neue wege gehen|gemeinsam mehr erreichen|im mittelpunkt steht|im herzen von|von entscheidender bedeutung|von zentraler bedeutung|ein wesentlicher bestandteil|ein unverzichtbarer bestandteil|unverzichtbares werkzeug|leistungsstarkes werkzeug|robuste grundlage|eine solide basis|ein solides fundament|breites spektrum|eine vielzahl von möglichkeiten|zahlreiche möglichkeiten|unbegrenzte möglichkeiten|ungeahnte möglichkeiten|einzigartige gelegenheit|lassen sie uns eintauchen|lassen sie uns einen blick|es ist kein geheimnis|nicht mehr wegzudenken|mehr denn je|heutzutage wichtiger denn je|in diesem artikel|abschließend lässt sich sagen|zusammenfassend lässt sich sagen|letztendlich|unterm strich|am ende des tages|denken sie daran|vergessen sie nicht|eine investition in die zukunft|der nächste schritt|die weichen stellen|bereit für die zukunft|alles aus einer hand|hand in hand|auf augenhöhe|eine neue ära'.split('|'),
  KONSTRUKCIE: [/\bnicht nur [^.;]{1,60},? sondern\b/iu],
  ZAVER: ['fazit', 'zusammenfassend', 'letztendlich', 'am ende', 'unterm strich', 'abschließend'],
  MORAL: ['denken sie daran', 'vergessen sie nicht', 'merke'],
  NEISTOTA: 'ich weiß nicht|ich bin mir nicht sicher|vielleicht|wahrscheinlich|vermutlich|ich habe mich geirrt|ich könnte mich irren|ich vermute|mir ist unklar|ich habe keine antwort'.split('|'),
  ODBOCKY: ['übrigens', 'nebenbei', 'apropos'],
  FUNKCNE: 'der die das ein eine und oder aber wenn als von zu in auf an bei für mit aus ist sind war waren sein es dies dass den dem des ich du er sie wir ihr nicht nur auch sich so wie um im am zum zur eines einer einem einen noch doch weil was wer welche werden wird kann soll hat haben'.split(' '),
  JA: 'ich mich mir mein meine wir uns unser unsere'.split(' '),
  TY: 'du dich dir dein deine ihr euch euer eure sie ihnen ihre'.split(' '),
  PRIPONY: ['ung', 'heit', 'keit', 'tion', 'ität', 'schaft'],
  VYNIMKY: [],
  SKRATKY: 'z. B.|d. h.|usw.|bzw.|ca.|Nr.|Dr.|GmbH.|u. a.|v. a.|Prof.|Dipl.|ggf.|inkl.|zzgl.'.split('|'),
  ODPOVED: /^(ja|nein|weil|die antwort ist|der grund ist)(?!\p{L})/iu,
  VZTAZNE: /,\s*(?:der|die|das|welch[\p{L}]*|wer)(?!\p{L})[^,]*$/iu,
  SPOJKY: 'und|oder', KMEN: 6,
  PRAHY: { ...en.PRAHY, M4: [4,.5], M8: [5,11] }
};
