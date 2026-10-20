# 🎲 Il Tavolo — D&D 5e

Un tavolo virtuale per giocare a Dungeons & Dragons 5e online con gli amici, tutto in italiano.
Il Master crea l'avventura e manda un link; ognuno entra dal proprio telefono o computer.

- **Lobby delle avventure**: si entra come Master (con password) o come Giocatore, scegliendo o creando il proprio personaggio.
- **Mappa tattica**: griglia regolabile, nebbia di guerra da scoprire col pennello, pedine da trascinare con la misura in metri, mappe caricate dal Master.
- **Iniziativa** con turno attivo evidenziato sulla mappa e avviso “Tocca a te!”.
- **Lancia-dadi** con vantaggio/svantaggio, tiri contro CA, critici e tiri segreti del Master.
- **Scheda personaggio** semplice o completa: PF e PF temporanei, riposi, tiri salvezza contro morte, abilità con competenza e maestria, attacchi, slot incantesimo, condizioni.
- **Diario condiviso** (missioni, PNG, bottino, domande per il DM con risposta).
- **Regole & PDF**: carichi i tuoi manuali, ci cerchi dentro e l'assistente li usa per rispondere.
- **Schermo del Master**: note segrete, appunti di sessione trasformati in voci del diario, bilanciamento degli scontri (DMG 2014).

Tutto si sincronizza da solo tra i dispositivi. Se la connessione cade si continua a giocare: le modifiche partono appena torna.

---

## Messa online (una volta sola)

### 1. Database Supabase

1. Apri il progetto su [supabase.com](https://supabase.com) → **SQL Editor** → **New query**.
2. Incolla tutto il contenuto di [`supabase/setup.sql`](supabase/setup.sql) e premi **Run**.

Lo script crea le tabelle nuove e copia lì le campagne della vecchia tabella `campaigns`. Si può rieseguire senza problemi.

> La vecchia tabella resta nel database come backup, ma il sito non può più leggerla: conteneva le password del Master in chiaro.
> Finché lo script non è stato eseguito il sito funziona solo in locale e lo dice nel pulsante ☁️ in alto.

### 2. Assistente IA (facoltativo)

Su Vercel → progetto → **Settings → Environment Variables** aggiungi:

| Nome | Valore |
| --- | --- |
| `GEMINI_API_KEY` | la chiave presa da [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | facoltativo, predefinito `gemini-flash-latest` |

Poi rifai il deploy (Deployments → ⋯ → Redeploy). La chiave resta sul server: i giocatori usano l'assistente senza vederla.
Senza chiave l'assistente funziona lo stesso, ma risponde solo con il glossario e la ricerca nei PDF.

### 3. Pubblicazione

Vercel pubblica in automatico ogni push su GitHub: i branch diversi da `main` diventano un'**anteprima** con un indirizzo suo,
`main` diventa il sito vero. Non serve nessun passaggio di build: sono file statici più la funzione in `api/`.

---

## Come si gioca

1. Il Master apre il sito, preme **👑 Crea Nuova Avventura**, sceglie nome e password.
2. Dal Tavolo preme **🏠 Home → 🔗 Invita Giocatori** e manda il link agli amici.
3. Ogni giocatore apre il link, sceglie **Sono un Giocatore** e crea (o sceglie) il suo personaggio.
4. Il Master prepara la mappa: carica un'immagine, copre tutto con la nebbia e scopre le zone col pennello man mano.

Il Master può premere **👁️ Vista** per vedere la mappa esattamente come la vedono i giocatori.

## Cosa è protetto e cosa no

- **Protetto dalla password del Master**: note segrete, appunti di sessione, nemici preparati. Stanno in una “cassaforte” nel database che si apre solo con la password giusta.
- **Tiri segreti del Master**: restano solo sul suo dispositivo.
- **PDF dei manuali**: restano nel browser di chi li carica, non vengono mai inviati online.
- **Non protetto**: non c'è un login, quindi chi ha il link può vedere e modificare la campagna (mappa, schede, diario).
  Va benissimo tra amici; non pubblicare il link in giro. Le pedine nascoste e la mappa sotto la nebbia non si vedono
  sullo schermo dei giocatori, ma un giocatore molto curioso potrebbe trovarle negli strumenti per sviluppatori del browser.

## Struttura del progetto

```
index.html          pagina dell'app
style.css           colori, tema chiaro/scuro, componenti
js/config.js        indirizzo Supabase e impostazioni
js/rules.js         regole 5e: condizioni, abilità, tabelle PE, dadi
js/store.js         modello dati, valori di default, conversione dal vecchio formato, salvataggio locale
js/sync.js          sincronizzazione con Supabase (tempo reale + controllo periodico) e cassaforte del Master
js/core.js          stato dell'interfaccia e permessi (chi può modificare cosa)
js/map.js           mappa, griglia, nebbia, pedine
js/table.js         iniziativa, dadi, assistente, barra del personaggio
js/sheet.js         scheda personaggio
js/journal.js       diario
js/books.js         PDF, ricerca, assistente
js/dm.js            schermo del Master, esporta/importa/duplica/elimina
js/app.js           avvio, lobby, ingresso nelle avventure
api/gemini.js       funzione Vercel che parla con Gemini
supabase/setup.sql  tabelle e funzioni del database
```

Per provarlo sul computer basta aprire `index.html` nel browser (l'assistente IA lì non c'è, il resto sì).
Le campagne salvate con la prima versione (file `.json`) si possono caricare con **Carica (.json)**.
