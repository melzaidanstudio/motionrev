import {
  Bebas_Neue,
  Caveat,
  Great_Vibes,
  Instrument_Serif,
  Inter,
  Lobster,
  Montserrat,
  Pacifico,
  Playfair_Display,
  Poppins,
  Space_Grotesk,
  Yellowtail,
} from "next/font/google";
import type { FontId } from "./options";

// Preview faces for the font picker. Not preloaded: only the Talking Head page uses them.
const poppins = Poppins({ subsets: ["latin"], weight: ["700"], preload: false });
const inter = Inter({ subsets: ["latin"], weight: ["800"], preload: false });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: ["400"], style: ["italic"], preload: false });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["800"], preload: false });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: ["400"], preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["600"], style: ["italic"], preload: false });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["700"], preload: false });
const lobster = Lobster({ subsets: ["latin"], weight: ["400"], preload: false });
const yellowtail = Yellowtail({ subsets: ["latin"], weight: ["400"], preload: false });
const pacifico = Pacifico({ subsets: ["latin"], weight: ["400"], preload: false });
const caveat = Caveat({ subsets: ["latin"], weight: ["700"], preload: false });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: ["400"], preload: false });

export const FONT_CLASS: Record<FontId, string> = {
  poppins: poppins.className,
  inter: inter.className,
  "instrument-serif": instrument.className,
  montserrat: montserrat.className,
  "bebas-neue": bebas.className,
  playfair: playfair.className,
  "space-grotesk": grotesk.className,
  lobster: lobster.className,
  yellowtail: yellowtail.className,
  pacifico: pacifico.className,
  caveat: caveat.className,
  "great-vibes": greatVibes.className,
};
