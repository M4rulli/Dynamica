export type Locale = "it" | "en";

const STORAGE_KEY = "ui-language";
const LANGUAGE_EVENT = "ui-language-change";

const it = {
  "page.landing.title": "Dynamica | Editor circuitale con analisi simbolica",
  "page.editor.title": "Dynamica Editor",
  "page.analysis.title": "Dynamica Analysis",

  "landing.theme": "Tema",
  "landing.themeToggle": "Cambia tema landing",
  "landing.languageToggle": "Cambia lingua",
  "landing.kicker": "Editor e analisi circuitale",
  "landing.heroTitle": "Il circuito, dall'idea ai conti.",
  "landing.heroSub": "Disegna lo schema, definisci i parametri e verifica i risultati senza spezzare il flusso di lavoro.",
  "landing.enterEditor": "Apri l'editor",
  "landing.learnMore": "Scopri come funziona",
  "landing.proofA": "Schema visuale",
  "landing.proofB": "Analisi a maglie e nodi",
  "landing.proofC": "Export SVG e LaTeX",
  "landing.navFeatures": "Funzioni",
  "landing.navLabel": "Navigazione principale",
  "landing.factsLabel": "Funzioni principali",
  "landing.previewLabel": "Anteprima dell'editor Dynamica",
  "landing.diagramLabel": "Schema di un circuito RC",
  "landing.fileName": "filtro_rc.dyn",
  "landing.saved": "Salvato",
  "landing.workspaceTitle": "Filtro RC / transitorio",
  "landing.inspectorTitle": "Componente",
  "landing.inspectorMode": "Modalità",
  "landing.inspectorKnown": "Nota",
  "landing.inspectorCurrent": "Corrente",
  "landing.statusReady": "Circuito valido",
  "landing.previewTopology": "4 nodi · 3 rami",
  "landing.boardTag": "Workbench",
  "landing.boardMeta": "stato locale",
  "landing.noteATitle": "Disegno prima, attrito dopo",
  "landing.noteABody": "Lo schema resta leggibile anche mentre cambi valori, orientamenti e incognite.",
  "landing.noteBTitle": "Analisi con memoria del circuito",
  "landing.noteBBody": "Quando apri il report, ti ritrovi il circuito vero. Non una copia semplificata.",
  "landing.storyKicker": "Un unico ambiente",
  "landing.storyTitle": "Meno passaggi tra strumenti. Più continuità nel ragionamento.",
  "landing.storyBody": "Dynamica conserva il legame tra ciò che disegni, i parametri che assegni e i risultati che ottieni.",
  "landing.storyItem1": "I componenti si comportano come componenti, non come icone decorative.",
  "landing.storyItem2": "Le etichette matematiche e i valori restano dentro il flusso di editing.",
  "landing.storyItem3": "L'analisi parte da quello che hai realmente disegnato, non da un esempio prefabbricato.",
  "landing.processKicker": "Dal canvas al report",
  "landing.processTitle": "Tre passaggi, nessun teatro.",
  "landing.processStep1Title": "Disegna",
  "landing.processStep1Body": "Componenti, connessioni ed etichette restano ordinati su una griglia precisa.",
  "landing.processStep2Title": "Configura",
  "landing.processStep2Body": "Valori, incognite e metodo di analisi si impostano accanto al circuito.",
  "landing.processStep3Title": "Verifica",
  "landing.processStep3Body": "Equazioni, matrici e risultati I-V-P raccolti in un report leggibile.",
  "landing.precisionTitle": "Progettato per continuità e precisione.",
  "landing.quote": "Un buon editor di circuiti non ti chiede di cambiare mentalita' ogni trenta secondi.",
  "landing.specsTitle": "Dettagli che contano davvero",
  "landing.specLabel1": "Sessione",
  "landing.specValue1": "Ripristino automatico",
  "landing.specLabel2": "Analisi",
  "landing.specValue2": "Maglie e nodi",
  "landing.specLabel3": "Output",
  "landing.specValue3": "SVG e LaTeX",
  "landing.specLabel4": "Analisi",
  "landing.specValue4": "Maglie + nodi",
  "landing.finalKicker": "Quando vuoi, entri e lavori",
  "landing.finalTitle": "Inizia con un nuovo circuito",
  "landing.finalBody": "Se vuoi vedere come si comporta davvero, la parte interessante inizia dall'editor.",
  "landing.goToEditor": "Vai all'Editor",
  "landing.repo": "Repository GitHub",
  "landing.footerNote": "Progettato per studio, verifica e documentazione circuitale.",
  "landing.copyright": "© 2026 Dynamica. Tutti i diritti riservati.",

  "nav.homeTitle": "Torna al menu principale",
  "nav.collapse": "Collassa sidebar",
  "nav.analysisMethods": "Metodi di Analisi",
  "nav.analyze": "Analizza",
  "nav.components": "Componenti",
  "nav.electricalDomain": "Dominio Elettrico",
  "nav.file": "File",
  "nav.importDummy": "Importa (Dummy)",
  "nav.saveDummy": "Salva (Dummy)",
  "nav.export": "Esporta",
  "nav.exportSvg": "Esporta SVG",
  "nav.exportLatex": "Esporta LaTeX",
  "nav.settings": "Impostazioni",
  "nav.grid": "Griglia",
  "nav.gridEnabled": "Griglia Attiva",
  "nav.gridCellSize": "Dimensione Celle",
  "nav.gridSubdivisions": "Sottodivisioni",
  "nav.general": "Generali",
  "nav.darkTheme": "Tema Scuro",
  "nav.language": "Lingua",
  "nav.languageCurrent": "Lingua selezionata: {language}",
  "nav.languageNameIt": "Italiano",
  "nav.languageNameEn": "English",

  "components.resistor": "Resistore",
  "components.capacitor": "Condensatore",
  "components.inductor": "Induttore",
  "components.voltageSource": "Generatore di Tensione",
  "components.currentSource": "Generatore di Corrente",
  "components.voltageSourceShort": "Gen. Tensione",
  "components.currentSourceShort": "Gen. Corrente",

  "inspector.toggle": "Mostra o nascondi inspector",
  "inspector.title": "Inspector",
  "inspector.noneSelected": "Nessuna selezione",
  "inspector.label": "Etichetta",
  "inspector.value": "Valore",
  "inspector.valuePlaceholder": "es. 300",
  "inspector.current": "Corrente",
  "inspector.currentPlaceholder": "es. 1.2",
  "inspector.currentUnknown": "Corrente incognita",
  "inspector.voltage": "Tensione",
  "inspector.voltagePlaceholder": "es. 12",
  "inspector.voltageUnknown": "Tensione incognita",

  "analysis.backToEditor": "Torna all'editor",
  "analysis.title": "Ambiente di Analisi Circuitale",
  "analysis.statusIdle": "In attesa",
  "analysis.clear": "Pulisci",
  "analysis.save": "Salva",
  "analysis.circuitSummary": "Riepilogo Circuito",
  "analysis.config": "Configurazione Analisi",
  "analysis.helpOpen": "Apri guida teoria analisi",
  "analysis.domain": "Dominio Operativo",
  "analysis.domainTime": "Dominio del Tempo",
  "analysis.domainLaplace": "Dominio di Laplace",
  "analysis.regime": "Regime",
  "analysis.regimeDc": "DC (Corrente Continua)",
  "analysis.regimeAc": "AC (Corrente Alternata)",
  "analysis.laplaceClassic": "Laplace Classico",
  "analysis.method": "Metodo",
  "analysis.mesh": "Analisi alle Maglie",
  "analysis.nodal": "Analisi ai Nodi",
  "analysis.theveninDummy": "Thevenin/Norton (Dummy)",
  "analysis.transientDummy": "Transitorio (Dummy)",
  "analysis.frequencyDummy": "Risposta in Frequenza (Dummy)",
  "analysis.graphInfo": "Informazioni Grafo",
  "analysis.latexOutput": "Output LaTeX",
  "analysis.elementsTable": "Tabella Elementi (I, V, P)",
  "analysis.powerBalance": "Bilancio di Potenza",
  "analysis.helpTitle": "Guida Rapida Teorica",
  "analysis.helpClose": "Chiudi guida",
  "analysis.theoryDomainTitle": "Scelta del Dominio",
  "analysis.theoryDomainTime": "Tempo:",
  "analysis.theoryDomainTimeBody": "usa equazioni differenziali dirette del circuito.",
  "analysis.theoryDomainLaplace": "Laplace:",
  "analysis.theoryDomainLaplaceBody": "converte in algebra nel dominio s tramite impedenze equivalenti.",
  "analysis.theoryDomainDcAc": "DC/AC:",
  "analysis.theoryDomainDcAcBody": "in DC si cercano condizioni statiche, in AC si lavora in regime sinusoidale.",
  "analysis.theoryMeshTitle": "Analisi alle Maglie",
  "analysis.theoryMeshBody1": "Si definiscono correnti di maglia indipendenti e si applica la LKT a ogni maglia fondamentale.",
  "analysis.theoryMeshBody2": "Forma compatta:",
  "analysis.theoryMeshBody2Tail": "dove I sono le correnti di maglia.",
  "analysis.theoryNodalTitle": "Analisi ai Nodi",
  "analysis.theoryNodalBody1": "Si scelgono tensioni nodali incognite e si applica la LKC ai nodi non di riferimento.",
  "analysis.theoryNodalBody2": "Il sistema risultante fornisce tensioni e correnti di ramo.",
  "analysis.summaryStatus": "Stato",
  "analysis.summaryNoCircuit": "Nessun circuito disponibile. Torna all'editor e premi \"Analizza\".",
  "analysis.summaryTotalComponents": "Componenti Totali",
  "analysis.jobId": "Job ID: {jobId}",
  "analysis.errorPrefix": "Errore: {error}",
  "analysis.graph": "Grafo",
  "analysis.incidenceMatrix": "Matrice di Incidenza",
  "analysis.bMatrix": "Matrice B (maglie-rami)",
  "analysis.graphUnavailable": "Grafo non disponibile.",
  "analysis.incidenceUnavailable": "Matrice di incidenza non disponibile.",
  "analysis.bMatrixUnavailable": "Matrice B non disponibile.",
  "analysis.powerBalanceUnavailable": "Bilancio non disponibile",
  "analysis.powerTableElement": "Elemento",
  "analysis.powerTableNoData": "Nessun dato disponibile",
  "analysis.missingCircuit": "Circuito mancante: apri l'editor e premi Analizza.",
  "analysis.nodalError": "Errore durante analisi nodale",
  "analysis.meshError": "Errore durante analisi a maglie",
  "analysis.unexpectedError": "Errore inatteso",
  "analysis.status.queued": "In coda",
  "analysis.status.running": "In esecuzione",
  "analysis.status.completed": "Completata",
  "analysis.status.failed": "Fallita",

  "errors.reason.value": "valore",
  "errors.reason.current": "corrente",
  "errors.reason.voltage": "tensione",
  "errors.missingParam": "Errore parametro mancante: {preview}{suffix}.",
  "errors.emptyCircuit": "Circuito vuoto: aggiungi almeno un componente.",
  "errors.integrityDangling": "Errore di integrità: componenti/rami scoperti ({preview}{suffix}).",
  "errors.integrityDisconnected": "Errore di integrità: il circuito non è completamente interconnesso.",
} as const;

const en: Record<keyof typeof it, string> = {
  "page.landing.title": "Dynamica | Circuit editor with symbolic analysis",
  "page.editor.title": "Dynamica Editor",
  "page.analysis.title": "Dynamica Analysis",

  "landing.theme": "Theme",
  "landing.themeToggle": "Change landing theme",
  "landing.languageToggle": "Change language",
  "landing.kicker": "Circuit editor and analysis",
  "landing.heroTitle": "From circuit idea to verified results.",
  "landing.heroSub": "Draw the schematic, define its parameters, and verify the results without breaking your workflow.",
  "landing.enterEditor": "Open the editor",
  "landing.learnMore": "See how it works",
  "landing.proofA": "Visual schematic",
  "landing.proofB": "Mesh and nodal analysis",
  "landing.proofC": "SVG and LaTeX export",
  "landing.navFeatures": "Features",
  "landing.navLabel": "Main navigation",
  "landing.factsLabel": "Core features",
  "landing.previewLabel": "Dynamica editor preview",
  "landing.diagramLabel": "RC circuit schematic",
  "landing.fileName": "rc_filter.dyn",
  "landing.saved": "Saved",
  "landing.workspaceTitle": "RC filter / transient",
  "landing.inspectorTitle": "Component",
  "landing.inspectorMode": "Mode",
  "landing.inspectorKnown": "Known",
  "landing.inspectorCurrent": "Current",
  "landing.statusReady": "Valid circuit",
  "landing.previewTopology": "4 nodes · 3 branches",
  "landing.boardTag": "Workbench",
  "landing.boardMeta": "local state",
  "landing.noteATitle": "Drawing first, friction later",
  "landing.noteABody": "The schematic stays readable while you change values, orientations, and unknowns.",
  "landing.noteBTitle": "Analysis that remembers the circuit",
  "landing.noteBBody": "When you open the report, you get the actual circuit back. Not a simplified copy.",
  "landing.storyKicker": "One environment",
  "landing.storyTitle": "Fewer tool changes. More continuity in your reasoning.",
  "landing.storyBody": "Dynamica preserves the connection between what you draw, the parameters you assign, and the results you obtain.",
  "landing.storyItem1": "Components behave like components, not decorative icons.",
  "landing.storyItem2": "Mathematical labels and values stay inside the editing flow.",
  "landing.storyItem3": "Analysis starts from what you actually drew, not from a prefab example.",
  "landing.processKicker": "From canvas to report",
  "landing.processTitle": "Three steps, no theater.",
  "landing.processStep1Title": "Draw",
  "landing.processStep1Body": "Components, connections, and labels stay aligned on a precise grid.",
  "landing.processStep2Title": "Configure",
  "landing.processStep2Body": "Set values, unknowns, and the analysis method beside the circuit.",
  "landing.processStep3Title": "Verify",
  "landing.processStep3Body": "Equations, matrices, and I-V-P results come together in a readable report.",
  "landing.precisionTitle": "Designed for continuity and precision.",
  "landing.quote": "A good circuit editor should not ask you to change mindset every thirty seconds.",
  "landing.specsTitle": "Details that actually matter",
  "landing.specLabel1": "Session",
  "landing.specValue1": "Automatic restore",
  "landing.specLabel2": "Analysis",
  "landing.specValue2": "Mesh and nodal",
  "landing.specLabel3": "Output",
  "landing.specValue3": "SVG and LaTeX",
  "landing.specLabel4": "Analysis",
  "landing.specValue4": "Mesh + nodal",
  "landing.finalKicker": "Whenever you want, you can just get to work",
  "landing.finalTitle": "Start a new circuit",
  "landing.finalBody": "If you want to see how it really behaves, the interesting part starts in the editor.",
  "landing.goToEditor": "Go to the editor",
  "landing.repo": "GitHub Repository",
  "landing.footerNote": "Built for circuit study, verification, and documentation.",
  "landing.copyright": "© 2026 Dynamica. All rights reserved.",

  "nav.homeTitle": "Back to main menu",
  "nav.collapse": "Collapse sidebar",
  "nav.analysisMethods": "Analysis Methods",
  "nav.analyze": "Analyze",
  "nav.components": "Components",
  "nav.electricalDomain": "Electrical Domain",
  "nav.file": "File",
  "nav.importDummy": "Import (Dummy)",
  "nav.saveDummy": "Save (Dummy)",
  "nav.export": "Export",
  "nav.exportSvg": "Export SVG",
  "nav.exportLatex": "Export LaTeX",
  "nav.settings": "Settings",
  "nav.grid": "Grid",
  "nav.gridEnabled": "Grid Enabled",
  "nav.gridCellSize": "Cell Size",
  "nav.gridSubdivisions": "Subdivisions",
  "nav.general": "General",
  "nav.darkTheme": "Dark Theme",
  "nav.language": "Language",
  "nav.languageCurrent": "Selected language: {language}",
  "nav.languageNameIt": "Italian",
  "nav.languageNameEn": "English",

  "components.resistor": "Resistor",
  "components.capacitor": "Capacitor",
  "components.inductor": "Inductor",
  "components.voltageSource": "Voltage Source",
  "components.currentSource": "Current Source",
  "components.voltageSourceShort": "Volt. Source",
  "components.currentSourceShort": "Curr. Source",

  "inspector.toggle": "Show or hide inspector",
  "inspector.title": "Inspector",
  "inspector.noneSelected": "No selection",
  "inspector.label": "Label",
  "inspector.value": "Value",
  "inspector.valuePlaceholder": "e.g. 300",
  "inspector.current": "Current",
  "inspector.currentPlaceholder": "e.g. 1.2",
  "inspector.currentUnknown": "Unknown current",
  "inspector.voltage": "Voltage",
  "inspector.voltagePlaceholder": "e.g. 12",
  "inspector.voltageUnknown": "Unknown voltage",

  "analysis.backToEditor": "Back to editor",
  "analysis.title": "Circuit Analysis Workspace",
  "analysis.statusIdle": "Idle",
  "analysis.clear": "Clear",
  "analysis.save": "Save",
  "analysis.circuitSummary": "Circuit Summary",
  "analysis.config": "Analysis Configuration",
  "analysis.helpOpen": "Open analysis theory guide",
  "analysis.domain": "Operating Domain",
  "analysis.domainTime": "Time Domain",
  "analysis.domainLaplace": "Laplace Domain",
  "analysis.regime": "Regime",
  "analysis.regimeDc": "DC (Direct Current)",
  "analysis.regimeAc": "AC (Alternating Current)",
  "analysis.laplaceClassic": "Classical Laplace",
  "analysis.method": "Method",
  "analysis.mesh": "Mesh Analysis",
  "analysis.nodal": "Nodal Analysis",
  "analysis.theveninDummy": "Thevenin/Norton (Dummy)",
  "analysis.transientDummy": "Transient (Dummy)",
  "analysis.frequencyDummy": "Frequency Response (Dummy)",
  "analysis.graphInfo": "Graph Information",
  "analysis.latexOutput": "LaTeX Output",
  "analysis.elementsTable": "Element Table (I, V, P)",
  "analysis.powerBalance": "Power Balance",
  "analysis.helpTitle": "Quick Theory Guide",
  "analysis.helpClose": "Close guide",
  "analysis.theoryDomainTitle": "Domain Selection",
  "analysis.theoryDomainTime": "Time:",
  "analysis.theoryDomainTimeBody": "uses the circuit's direct differential equations.",
  "analysis.theoryDomainLaplace": "Laplace:",
  "analysis.theoryDomainLaplaceBody": "turns the problem into algebra in the s-domain through equivalent impedances.",
  "analysis.theoryDomainDcAc": "DC/AC:",
  "analysis.theoryDomainDcAcBody": "DC looks for steady-state conditions, while AC works in sinusoidal steady state.",
  "analysis.theoryMeshTitle": "Mesh Analysis",
  "analysis.theoryMeshBody1": "Independent mesh currents are defined and KVL is applied to each fundamental mesh.",
  "analysis.theoryMeshBody2": "Compact form:",
  "analysis.theoryMeshBody2Tail": "where I are the mesh currents.",
  "analysis.theoryNodalTitle": "Nodal Analysis",
  "analysis.theoryNodalBody1": "Unknown node voltages are selected and KCL is applied to the non-reference nodes.",
  "analysis.theoryNodalBody2": "The resulting system provides branch voltages and currents.",
  "analysis.summaryStatus": "Status",
  "analysis.summaryNoCircuit": "No circuit available. Return to the editor and click \"Analyze\".",
  "analysis.summaryTotalComponents": "Total Components",
  "analysis.jobId": "Job ID: {jobId}",
  "analysis.errorPrefix": "Error: {error}",
  "analysis.graph": "Graph",
  "analysis.incidenceMatrix": "Incidence Matrix",
  "analysis.bMatrix": "B Matrix (mesh-branch)",
  "analysis.graphUnavailable": "Graph not available.",
  "analysis.incidenceUnavailable": "Incidence matrix not available.",
  "analysis.bMatrixUnavailable": "B matrix not available.",
  "analysis.powerBalanceUnavailable": "Balance not available",
  "analysis.powerTableElement": "Element",
  "analysis.powerTableNoData": "No data available",
  "analysis.missingCircuit": "Missing circuit: open the editor and click Analyze.",
  "analysis.nodalError": "Error during nodal analysis",
  "analysis.meshError": "Error during mesh analysis",
  "analysis.unexpectedError": "Unexpected error",
  "analysis.status.queued": "Queued",
  "analysis.status.running": "Running",
  "analysis.status.completed": "Completed",
  "analysis.status.failed": "Failed",

  "errors.reason.value": "value",
  "errors.reason.current": "current",
  "errors.reason.voltage": "voltage",
  "errors.missingParam": "Missing parameter error: {preview}{suffix}.",
  "errors.emptyCircuit": "Empty circuit: add at least one component.",
  "errors.integrityDangling": "Integrity error: dangling components/branches ({preview}{suffix}).",
  "errors.integrityDisconnected": "Integrity error: the circuit is not fully interconnected.",
};

const translations = { it, en };

type TranslationKey = keyof typeof it;

type LocaleChangeDetail = {
  locale: Locale;
};

function isLocale(value: string | null): value is Locale {
  return value === "it" || value === "en";
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => `${vars[key] ?? ""}`);
}

function currentPageTitleKey(): TranslationKey {
  const path = window.location.pathname;
  if (path.endsWith("/pages/analysis.html")) return "page.analysis.title";
  if (path.endsWith("/pages/editor.html")) return "page.editor.title";
  return "page.landing.title";
}

function setDocumentMetadata(locale: Locale): void {
  document.documentElement.lang = locale;
  document.title = translations[locale][currentPageTitleKey()];
}

function collectTranslatableElements(root: ParentNode): HTMLElement[] {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-i18n], [data-i18n-attr]"));
  if (root instanceof HTMLElement && (root.hasAttribute("data-i18n") || root.hasAttribute("data-i18n-attr"))) {
    nodes.unshift(root);
  }
  return nodes;
}

function applyAttributeTranslations(element: HTMLElement, locale: Locale): void {
  const mapping = element.dataset.i18nAttr;
  if (!mapping) return;

  mapping
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .forEach((entry) => {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex <= 0) return;
      const attrName = entry.slice(0, separatorIndex).trim();
      const key = entry.slice(separatorIndex + 1).trim() as TranslationKey;
      element.setAttribute(attrName, translations[locale][key] ?? key);
    });
}

function readStoredLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY);
  return isLocale(saved) ? saved : "it";
}

export function getLocale(): Locale {
  return readStoredLocale();
}

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  return interpolate(translations[getLocale()][key], vars);
}

export function translateComponentType(type: string, options?: { short?: boolean }): string {
  switch (type) {
    case "resistor":
      return t("components.resistor");
    case "capacitor":
      return t("components.capacitor");
    case "inductor":
      return t("components.inductor");
    case "voltage_source":
      return t(options?.short ? "components.voltageSourceShort" : "components.voltageSource");
    case "current_source":
      return t(options?.short ? "components.currentSourceShort" : "components.currentSource");
    default:
      return type;
  }
}

export function translateJobStatus(status: "queued" | "running" | "completed" | "failed"): string {
  return t(`analysis.status.${status}` as TranslationKey);
}

export function applyTranslations(root: ParentNode = document): void {
  const locale = getLocale();
  setDocumentMetadata(locale);

  collectTranslatableElements(root).forEach((element) => {
    const textKey = element.dataset.i18n as TranslationKey | undefined;
    if (textKey) {
      element.textContent = translations[locale][textKey] ?? textKey;
    }
    applyAttributeTranslations(element, locale);
  });
}

export function initLocale(): Locale {
  const locale = readStoredLocale();
  setDocumentMetadata(locale);
  return locale;
}

export function setLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale);
  applyTranslations(document);
  window.dispatchEvent(new CustomEvent<LocaleChangeDetail>(LANGUAGE_EVENT, { detail: { locale } }));
}

export function onLocaleChange(handler: (locale: Locale) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<LocaleChangeDetail>).detail;
    handler(detail.locale);
  };
  window.addEventListener(LANGUAGE_EVENT, listener);
  return () => {
    window.removeEventListener(LANGUAGE_EVENT, listener);
  };
}
