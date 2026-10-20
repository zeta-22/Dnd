// Configurazione del Tavolo.
// La chiave "publishable" di Supabase è fatta per stare nel browser: cosa si può
// leggere o modificare lo decidono le regole del database (vedi supabase/setup.sql).
const TAVOLO_CONFIG = {
  supabaseUrl: 'https://vkjhrpkrpxrgxpfxrmsr.supabase.co',
  supabaseKey: 'sb_publishable_UPKBNNNxi5TRiKN_lQZpCg_F2BllzX8',
  // Funzione Vercel che parla con Gemini tenendo la chiave sul server (api/gemini.js)
  aiEndpoint: '/api/gemini',
  // pdf.js viene caricato solo quando serve indicizzare un PDF
  pdfJsUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfJsWorkerUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
};
