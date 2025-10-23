"use client";
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardList,
  Receipt,
  FileText,
  Sparkles,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

/* ---------------------------------------------------
   💡 Application pédagogique : Écritures de clôture
   FNP, AAR, CCA, FAE, AAE, PCA + Extournes
--------------------------------------------------- */

// Types
 type Side = "Debit" | "Credit";
 type InputRow = { account: string; amount: string; side: '' | Side };
 type EntryKey = "FNP" | "AAR" | "CCA" | "FAE" | "AAE" | "PCA";
 type Line = { account: string; label: string; side: Side; formula: (p: Params) => number };
 type Params = { amountHT: number; tvaRate: number };
 type EntryModel = {
   key: EntryKey;
   title: string;
   group: "Charges" | "Produits";
   description: string;
   accountMain: string;
   tvaAccount?: string;
   closing: Line[];
   reversal: Line[];
   examples?: string[];
 };

// Utilitaires
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// ✅ Arrondi TVA précis au centime
const computeTVA = (amountHT: number, tvaRate: number) => {
  const tva = amountHT * (tvaRate / 100);
  return Math.round(tva * 100) / 100;
};
const TTC = (ht: number, tva: number) => Math.round((ht + tva) * 100) / 100;
const makeReversal = (lines: Line[]): Line[] =>
  lines.map((l) => ({ ...l, side: l.side === "Debit" ? "Credit" : "Debit" }));

/* ---------------------------------------------------
   📘 Modèles comptables
--------------------------------------------------- */
const MODELS: EntryModel[] = [
  {
    key: "FNP",
    title: "FNP – Factures non parvenues",
    group: "Charges",
    description: "Charge de N dont la facture sera reçue en N+1.",
    accountMain: "4081",
    tvaAccount: "44586",
    closing: [
      { account: "6xxx", label: "Charge (HT)", side: "Debit", formula: (p) => p.amountHT },
      { account: "44586", label: "TVA déductible à régulariser", side: "Debit", formula: (p) => computeTVA(p.amountHT, p.tvaRate) },
      { account: "4081", label: "Fournisseur – FNP (TTC)", side: "Credit", formula: (p) => TTC(p.amountHT, computeTVA(p.amountHT, p.tvaRate)) },
    ],
    reversal: [],
  },
  {
    key: "AAR",
    title: "AAR – Avoir à recevoir",
    group: "Charges",
    description: "Avoir relatif à une charge de N, reçu en N+1.",
    accountMain: "4098",
    tvaAccount: "44586",
    closing: [
      { account: "4098", label: "Fournisseur – Avoir à recevoir (TTC)", side: "Debit", formula: (p) => TTC(p.amountHT, computeTVA(p.amountHT, p.tvaRate)) },
      { account: "6xxx", label: "Charge (HT)", side: "Credit", formula: (p) => p.amountHT },
      { account: "44586", label: "TVA déductible à régulariser", side: "Credit", formula: (p) => computeTVA(p.amountHT, p.tvaRate) },
    ],
    reversal: [],
  },
  {
    key: "CCA",
    title: "CCA – Charges constatées d’avance",
    group: "Charges",
    description: "Charge facturée en N couvrant une période de N+1.",
    accountMain: "486",
    closing: [
      { account: "486", label: "Charges constatées d’avance", side: "Debit", formula: (p) => p.amountHT },
      { account: "6xxx", label: "Charge (HT)", side: "Credit", formula: (p) => p.amountHT },
    ],
    reversal: [],
  },
  {
    key: "FAE",
    title: "FAE – Factures à établir",
    group: "Produits",
    description: "Vente/prestation de N facturée en N+1.",
    accountMain: "4181",
    tvaAccount: "44587",
    closing: [
      { account: "4181", label: "Client – FAE (TTC)", side: "Debit", formula: (p) => TTC(p.amountHT, computeTVA(p.amountHT, p.tvaRate)) },
      { account: "7xxx", label: "Produit (HT)", side: "Credit", formula: (p) => p.amountHT },
      { account: "44587", label: "TVA collectée à régulariser", side: "Credit", formula: (p) => computeTVA(p.amountHT, p.tvaRate) },
    ],
    reversal: [],
  },
  {
    key: "AAE",
    title: "AAE – Avoir à établir",
    group: "Produits",
    description: "Avoir de vente à émettre sur une opération de N.",
    accountMain: "4198",
    tvaAccount: "44587",
    closing: [
      { account: "7xxx", label: "Produit (HT)", side: "Debit", formula: (p) => p.amountHT },
      { account: "44587", label: "TVA collectée à régulariser", side: "Debit", formula: (p) => computeTVA(p.amountHT, p.tvaRate) },
      { account: "4198", label: "Client – Avoir à établir (TTC)", side: "Credit", formula: (p) => TTC(p.amountHT, computeTVA(p.amountHT, p.tvaRate)) },
    ],
    reversal: [],
  },
  {
    key: "PCA",
    title: "PCA – Produits constatés d’avance",
    group: "Produits",
    description: "Produit facturé en N mais correspondant à N+1.",
    accountMain: "487",
    closing: [
      { account: "7xxx", label: "Produit (HT)", side: "Debit", formula: (p) => p.amountHT },
      { account: "487", label: "Produits constatés d’avance", side: "Credit", formula: (p) => p.amountHT },
    ],
    reversal: [],
  },
];
// Initialise les extournes une seule fois
MODELS.forEach((m) => (m.reversal = makeReversal(m.closing)));

/* ---------------------------------------------------
   🧠 Composants utilitaires
--------------------------------------------------- */
function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Icon className="w-6 h-6" />
      <div>
        <h2 className="text-xl font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function LinesTable({ lines }: { lines: Array<{ account: string; label: string; side: Side; amount?: number }> }) {
  return (
    <div className="w-full overflow-auto rounded-2xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th scope="col" className="text-left p-3">Compte</th>
            <th scope="col" className="text-left p-3">Libellé</th>
            <th scope="col" className="text-left p-3">Sens</th>
            <th scope="col" className="text-right p-3">Montant (€)</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t">
              <td className="p-3 font-mono">{l.account}</td>
              <td className="p-3">{l.label}</td>
              <td className="p-3">{l.side === "Debit" ? "Débit" : "Crédit"}</td>
              <td className="p-3 text-right">{l.amount !== undefined ? fmt(l.amount) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------
   🧾 Application principale
--------------------------------------------------- */
export default function App() {
  const [tab, setTab] = useState("cours");
  const [selectedModel, setSelectedModel] = useState<EntryKey>("FNP");
  const [amountHT, setAmountHT] = useState<number>(1000);
  const [tvaRate, setTvaRate] = useState<number>(20);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6" /> Formation – Écritures de clôture
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Apprends à passer les FNP, AAR, CCA, FAE, AAE, PCA avec extournes automatiques.
        </p>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="cours">Cours</TabsTrigger>
          <TabsTrigger value="pratique">Pratique</TabsTrigger>
          <TabsTrigger value="exercices">Exercices</TabsTrigger>
          <TabsTrigger value="quiz">Quiz</TabsTrigger>
        </TabsList>

        {/* Onglet Cours */}
        <TabsContent value="cours">
          <SectionTitle icon={BookOpen} title="Cours – Modèles d’écritures" subtitle="Clôture (31/12/N) et Extournes (01/01/N+1)" />
          <div className="grid md:grid-cols-2 gap-6">
            {MODELS.map((m) => (
              <Card key={m.key} className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="w-5 h-5" /> {m.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                  <LinesTable lines={m.closing} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Onglet Pratique */}
        <TabsContent value="pratique">
          <SectionTitle icon={ClipboardList} title="Pratique guidée" subtitle="Choisis un modèle et saisis le montant HT + le taux de TVA" />

          <div className="grid md:grid-cols-3 gap-4 items-end mb-6">
            <div>
              <Label>Modèle</Label>
              <select
                className="mt-2 w-full border rounded-xl p-2"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as EntryKey)}
              >
                {MODELS.map((m) => (
                  <option key={m.key} value={m.key}>{m.title}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="ht">Montant HT (€)</Label>
              <Input id="ht" type="number" inputMode="decimal" placeholder="1000"
                className="mt-2"
                value={Number.isFinite(amountHT) ? amountHT : 0}
                onChange={(e) => setAmountHT(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <Label>TVA (%)</Label>
              <div className="mt-2 flex items-center gap-3">
                <Slider value={[tvaRate]} min={0} max={25} step={0.5}
                  onValueChange={(v) => setTvaRate(v[0])}
                  className="flex-1"
                />
                <span className="w-14 text-right">{tvaRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <ComputedEntries modelKey={selectedModel} amountHT={amountHT} tvaRate={tvaRate} />
        </TabsContent>

        {/* Onglet Exercices – maintenant pour FNP, AAR, CCA, FAE, AAE, PCA */}
        <TabsContent value="exercices">
          <SectionTitle icon={Receipt} title="Exercices – Passer l’écriture" subtitle="Lis l'énoncé, choisis le bon modèle et calcule les montants (HT/TVA/TTC si besoin)" />
          <ExerciseEngine />
        </TabsContent>

        {/* Onglet Quiz */}
        <TabsContent value="quiz">
          <SectionTitle icon={Brain} title="Quiz – Reconnaissance des situations" subtitle="Choisis le bon modèle à partir de l'énoncé" />
          <QuizEngine />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------------------------------
   🧮 Calculs dynamiques – composant dédié
--------------------------------------------------- */
function ComputedEntries({ modelKey, amountHT, tvaRate }: { modelKey: EntryKey; amountHT: number; tvaRate: number; }) {
  const model = useMemo(() => MODELS.find(m => m.key === modelKey)!, [modelKey]);

  // enrichit les lignes avec les montants calculés au centime
  const enrich = (lines: Line[]) =>
    lines.map(l => {
      const ht = Math.round(amountHT * 100) / 100;
      const amount = l.formula({ amountHT: ht, tvaRate });
      const rounded = Math.round(amount * 100) / 100;
      return { ...l, amount: rounded };
    });

  const closing = useMemo(() => enrich(model.closing), [model, amountHT, tvaRate]);
  const reversal = useMemo(() => enrich(model.reversal), [model, amountHT, tvaRate]);

  const sum = (side: Side, lines: any[]) =>
    Math.round(lines.filter((l: any) => l.side === side).reduce((s: number, l: any) => s + (l.amount || 0), 0) * 100) / 100;

  const deb = sum("Debit", closing);
  const cre = sum("Credit", closing);
  const balanced = Math.abs(deb - cre) < 0.005;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Écriture de clôture – {model.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LinesTable lines={closing} />
          <div className="flex justify-end gap-6 text-sm">
            <div>Total Débit : <strong>{fmt(deb)}</strong> €</div>
            <div>Total Crédit : <strong>{fmt(cre)}</strong> €</div>
            <div className={balanced ? "text-green-600" : "text-red-600"}>
              {balanced ? "Équilibrée ✅" : "Non équilibrée ⚠️"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Extourne (01/01/N+1)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LinesTable lines={reversal} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------
   🎯 Moteur d'exercices étendu (6 modèles)
--------------------------------------------------- */
function ExerciseEngine() {
  type Diff = 'facile'|'moyen'|'difficile';
  const [difficulty, setDifficulty] = useState<Diff>('facile');
  const [seed, setSeed] = useState(0);
  const [ex, setEx] = useState(()=> makeScenario('facile'));

  // inputs dynamiques : une ligne = {account, amount, side}
  const [inputs, setInputs] = useState<Array<{ account: string; amount: string; side: '' | Side }>>([]);

  const [validated, setValidated] = useState(false);

  // Re-génère un scénario quand difficulté ou seed change
  React.useEffect(() => {
  const next = makeScenario(difficulty);
  setEx(next);
  const blanks: InputRow[] = buildExpectedLines(next).map((l) => ({
    account: difficulty === "facile" ? l.account : "",
    amount: "",
    // en facile/moyen: valeur vide typée; en difficile: on peut préremplir avec le bon sens
    side: (difficulty === "facile" || difficulty === "moyen")
      ? ('' as const)
      : (l.side as Side),
  }));

  setInputs(blanks);
  setValidated(false);
}, [difficulty, seed]);


  const expectedLines = useMemo(()=> buildExpectedLines(ex), [ex]);

  // Comptes leurres
  const distractors = ['4081','4181','44586','44587','4098','4198','512','401','606','607','706','707','487','486','6xxx','7xxx'];

  // Validation
  const sidesOk = () => {
    if (difficulty === 'facile' || difficulty === 'moyen') {
      return inputs.every((inp, i) => inp.side === expectedLines[i].side);
    }
    return true; // en difficile, on n'impose pas la saisie du sens
  };

  const accountsOk = () => {
    if (difficulty==='facile') return true; // fournis
    // compare table de comptes (ordre exact ici, pour rester simple)
    return inputs.every((inp, i)=> (inp.account||'').trim() === expectedLines[i].account);
  };

  const amountsOk = () => {
    return inputs.every((inp, i)=> {
      const val = round2(parseFloat(inp.amount)||0);
      return Math.abs(val - (expectedLines[i].amount ?? 0)) < 0.01;
    });
  };

  const allGood = validated && accountsOk() && sidesOk() && amountsOk();

  const setInput = (i: number, patch: Partial<InputRow>) => {
    setInputs(prev => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
};

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5"/>
          Exercice ({difficulty}) — {ex.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Enoncé */}
        <div className="text-sm space-y-1">
          <p className="leading-relaxed">{ex.statement}</p>
          <p className="text-muted-foreground">Montant HT: <strong>{fmt(ex.amountHT)}</strong> €{ex.kind==='tva' && <> • TVA: <strong>{ex.tvaRate}%</strong> • TTC: <strong>{fmt(TTC(ex.amountHT, computeTVA(ex.amountHT, ex.tvaRate)))}</strong> €</>}</p>
          {ex.kind==='prorata' && (
            <p className="text-muted-foreground">Période: {fmtDate(ex.start!)} → {fmtDate(ex.end!)} • Portion N+1: <strong>{ex.afterMonths}</strong> mois / {ex.totalMonths} → Base: <strong>{fmt(ex.prorataBase!)}</strong> €</p>
          )}
        </div>

        {/* Saisie des lignes */}
        <div className="space-y-3">
          {expectedLines.map((line, i)=> (
            <div key={i} className="rounded-xl border p-3 text-sm grid md:grid-cols-3 gap-3 items-end">
              <div>
                <Label>Sens</Label>
                {(difficulty === 'facile' || difficulty === 'moyen') ? (
                  <select
  className="mt-2 w-full border rounded-xl p-2"
  value={inputs[i]?.side ?? ''}       // toujours '' | 'Debit' | 'Credit'
  onChange={(e) =>
    setInput(i, {
      side: e.target.value === '' ? ('' as const) : (e.target.value as Side),
    })
  }
>
                    <option value="">— choisir —</option>
                    <option value="Debit">Débit</option>
                    <option value="Credit">Crédit</option>
                  </select>
                ) : (
                  <div className="mt-2 font-medium">{line.side === 'Debit' ? 'Débit' : 'Crédit'}</div>
                )}
              </div>

              <div>
                <Label>Compte</Label>
                {difficulty==='moyen' ? (
                  <select className="mt-2 w/full border rounded-xl p-2" value={inputs[i]?.account||''}
                          onChange={(e)=> setInput(i,{account:e.target.value})}>
                    <option value="">— choisir —</option>
                    {[...new Set(shuffle([line.account, ...distractors]).slice(0, 8))].map((c, j) => (
                      <option key={`${c}-${j}`} value={c}>{c}</option>
                    ))}
                  </select>
                ) : difficulty==='difficile' ? (
                  <Input className="mt-2" placeholder={`ex: ${line.account}`} value={inputs[i]?.account||''}
                         onChange={(e)=> setInput(i,{account:e.target.value})}/>
                ) : (
                  <div className="mt-2 font-mono">{line.account}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">{line.label}</div>
              </div>
              <div>
                <Label>Montant (€)</Label>
                <Input className="mt-2" placeholder="0,00" inputMode="decimal" value={inputs[i]?.amount||''}
                       onChange={(e)=> setInput(i,{amount:e.target.value})}/>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 items-center">
          <Button onClick={()=> setValidated(true)} className="rounded-xl">Valider</Button>
          <Button variant="secondary" className="rounded-xl" onClick={()=> setSeed(s=>s+1)}>Nouvel exercice</Button>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <Label>Difficulté</Label>
            <select className="border rounded-xl p-2" value={difficulty} onChange={(e)=>setDifficulty(e.target.value as any)}>
              <option value="facile">Facile</option>
              <option value="moyen">Moyen</option>
              <option value="difficile">Difficile</option>
            </select>
          </div>
        </div>

        {/* Résultats */}
        {validated && (
          <div className="rounded-xl border p-4 text-sm space-y-2">
            <div>
              Comptes : {accountsOk() ? <span className="text-green-600">✅ corrects</span> : <span className="text-red-600">❌ incorrects</span>}
            </div>
            <div>
              Montants : {amountsOk() ? <span className="text-green-600">✅ corrects</span> : <span className="text-red-600">❌ incorrects</span>}
            </div>
            {!accountsOk() || !amountsOk() ? (
              <details className="pt-2">
                <summary className="cursor-pointer">Voir la solution détaillée</summary>
                <div className="mt-3 space-y-3">
                  <p className="text-muted-foreground">Écriture de clôture attendue :</p>
                  <LinesTable lines={expectedLines} />
                </div>
              </details>
            ) : null}
            {allGood && <div className="pt-2 text-green-700">Bravo ! 🎉</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ----- Scénarios couvrant les 6 modèles -----

// Évite de tirer deux fois d'affilée le même modèle
let lastKey: EntryKey | null = null;
function makeScenario(level:'facile'|'moyen'|'difficile'){
  type Kind = 'tva'|'prorata';
  // Génère un montant aléatoire cohérent
  const amount = (lvl: typeof level) => lvl==='facile' ? 1000 : lvl==='moyen' ? Math.round((500 + Math.random() * 4500) * 100) / 100 : Math.round((50 + Math.random() * 1950) * 100) / 100;
  const tvaRates = [20, 10, 5.5, 0];
  const randTVA = tvaRates[Math.floor(Math.random()*tvaRates.length)];

  const pool: Array<any> = [
    { key:'FNP', kind:'tva', title:'FNP – Charge de décembre non facturée',
      statement:(a:number, t:number)=> `Prestataire a réalisé une prestation en décembre N. La facture sera reçue en janvier N+1. Montant HT ${fmt(a)} €, TVA ${t}%. Passer l'écriture de FNP au 31/12/N.`,
      amountHT: amount(level), tvaRate: randTVA },
    { key:'AAR', kind:'tva', title:'AAR – Avoir fournisseur à recevoir',
      statement:(a:number, t:number)=> `Avoir sur charge de N à recevoir en N+1 (remise/ristourne). Montant HT ${fmt(a)} €, TVA ${t}%. Passer l'écriture d'AAR au 31/12/N.`,
      amountHT: amount(level), tvaRate: randTVA },
    { key:'FAE', kind:'tva', title:'FAE – Vente de décembre à facturer',
      statement:(a:number, t:number)=> `Prestation/vente réalisée en décembre N, facturation en janvier N+1. Montant HT ${fmt(a)} €, TVA ${t}%. Passer l'écriture de FAE au 31/12/N.`,
      amountHT: amount(level), tvaRate: randTVA },
    { key:'AAE', kind:'tva', title:'AAE – Avoir client à établir',
      statement:(a:number, t:number)=> `Avoir de vente à établir concernant une opération de N. Montant HT ${fmt(a)} €, TVA ${t}%. Passer l'écriture d'AAE au 31/12/N.`,
      amountHT: amount(level), tvaRate: randTVA },
    // CCA & PCA au prorata
    { key:'CCA', kind:'prorata', title:'CCA – Assurance annuelle payée en novembre',
      start: new Date('2024-11-01'), end: new Date('2025-10-31'),
      statement:(a:number)=> `Prime d'assurance payée en novembre N couvrant novembre N à octobre N+1. Montant HT ${fmt(a)} €. Constate la part N+1 au 31/12/N.`,
      amountHT: amount(level) },
    { key:'PCA', kind:'prorata', title:'PCA – Abonnement logiciel facturé en décembre',
      start: new Date('2024-12-01'), end: new Date('2025-05-31'),
      statement:(a:number)=> `Abonnement logiciel vendu en décembre N couvrant décembre N à mai N+1. Montant HT ${fmt(a)} €. Constate la part à reporter en N+1.`,
      amountHT: amount(level) },
  ];

  let idx = Math.floor(Math.random() * pool.length);
  if (lastKey) {
    let attempts = 0;
    while (pool[idx].key === lastKey && attempts < 10) {
      idx = Math.floor(Math.random() * pool.length);
      attempts++;
    }
  }
  const chosen = pool[idx];
  lastKey = chosen.key;

  if (chosen.kind==='prorata'){
    const totalMonths = diffMonthsInclusive(chosen.start, chosen.end);
    const afterMonths = monthsInNextYear(chosen.start, chosen.end);
    const prorataBase = round2(chosen.amountHT * (afterMonths / totalMonths));
    return {
      key: chosen.key as EntryKey,
      title: chosen.title as string,
      statement: chosen.statement(chosen.amountHT),
      kind: 'prorata' as const,
      start: chosen.start as Date,
      end: chosen.end as Date,
      amountHT: round2(chosen.amountHT),
      totalMonths,
      afterMonths,
      prorataBase,
      tvaRate: 0,
    };
  }

  // TVA scenario
  return {
    key: chosen.key as EntryKey,
    title: chosen.title as string,
    statement: chosen.statement(chosen.amountHT, chosen.tvaRate),
    kind: 'tva' as const,
    amountHT: round2(chosen.amountHT),
    tvaRate: chosen.tvaRate as number,
  };
}

// Construit les lignes attendues selon le scénario
function buildExpectedLines(ex:any){
  const model = MODELS.find(m=> m.key===ex.key)!;
  if (ex.kind==='prorata'){
    const portion = round2(ex.prorataBase);
    // CCA/PCA uniquement (2 lignes)
    if (ex.key==='CCA'){
      return [
        { account:'486', label:"Charges constatées d’avance", side:'Debit' as Side, amount: portion },
        { account:'6xxx', label:"Charge (HT)", side:'Credit' as Side, amount: portion },
      ];
    }
    if (ex.key==='PCA'){
      return [
        { account:'7xxx', label:"Produit (HT)", side:'Debit' as Side, amount: portion },
        { account:'487', label:"Produits constatés d’avance", side:'Credit' as Side, amount: portion },
      ];
    }
  }
  // tva models (FNP, AAR, FAE, AAE) – 3 lignes
  const enrich = (l: Line) => {
    const val = l.formula({ amountHT: ex.amountHT, tvaRate: ex.tvaRate });
    return { account: l.account, label: l.label, side: l.side, amount: round2(val) };
  };
  return model.closing.map(enrich);
}

/* ----- Utils dates & nombres ----- */
function diffMonthsInclusive(a:Date,b:Date){
  // compte les mois entiers inclus (ex: déc→mars = 4)
  return (b.getFullYear()-a.getFullYear())*12 + (b.getMonth()-a.getMonth()) + 1;
}
function monthsInNextYear(a:Date,b:Date){
  // mois de N+1 dans l'intervalle (à partir de janv N+1)
  const janNext = new Date(a.getFullYear()+1, 0, 1);
  if (b < janNext) return 0;
  const start = new Date(Math.max(janNext.getTime(), a.getTime()));
  return diffMonthsInclusive(start, b);
}
function fmtDate(d:Date){
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
}
function round2(n:number){ return Math.round(n*100)/100; }
function shuffle<T>(arr:T[]):T[]{
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

/* ---------------------------------------------------
   🧪 Quiz
--------------------------------------------------- */
function QuizEngine() {
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const questions = useMemo(() => makeQuiz(8), []);

  const q = questions[qIndex];

  // Feedback immédiat
  const [selected, setSelected] = useState<EntryKey | null>(null);
  const [feedback, setFeedback] = useState<string>("");

  const onChoose = (k: EntryKey) => {
    if (selected) return; // éviter double clic
    setSelected(k);
    if (k === q.answer) setScore((s) => s + 1);
    setFeedback(makeExplanation(k, q.answer, q.statement));
  };

  const next = () => {
    setSelected(null);
    setFeedback("");
    const n = qIndex + 1;
    if (n >= questions.length) setFinished(true);
    else setQIndex(n);
  };

  const restart = () => {
    setQIndex(0);
    setScore(0);
    setFinished(false);
    setSelected(null);
    setFeedback("");
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" /> Quiz
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!finished ? (
          <>
            <div className="text-sm">
              <div className="mb-2 text-muted-foreground">
                Question {qIndex + 1}/{questions.length}
              </div>
              <p className="leading-relaxed">{q.statement}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {MODELS.map((m) => {
                const isCorrect = m.key === q.answer;
                const variant = selected ? (isCorrect ? "default" : "secondary") : "secondary";
                return (
                  <Button
                    key={m.key}
                    variant={variant as any}
                    className={`justify-start rounded-xl ${
                      selected && isCorrect ? "ring-2 ring-green-500" : ""
                    }`}
                    disabled={!!selected}
                    onClick={() => onChoose(m.key)}
                  >
                    {m.title}
                  </Button>
                );
              })}
            </div>

            <div className="text-sm text-muted-foreground">Score : {score}</div>

            {/* Feedback */}
            {selected && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  selected === q.answer ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                }`}
              >
                <div className="font-medium mb-1">
                  {selected === q.answer ? "✅ Bonne réponse" : "❌ Mauvaise réponse"}
                </div>
                <p className="leading-relaxed">{feedback}</p>
                <div className="mt-3">
                  <Button className="rounded-xl" onClick={next}>
                    Continuer
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="text-lg">
              Score final : <strong>{score}/{questions.length}</strong>{" "}
              {score / questions.length >= 0.8
                ? "🎉 Excellent !"
                : score / questions.length >= 0.5
                ? "👍 Bien joué"
                : "🧠 Continue à t’entraîner"}
            </div>
            <Button className="rounded-xl" onClick={restart}>
              Recommencer
            </Button>
            <details className="mt-2">
              <summary className="cursor-pointer">Voir les corrigés</summary>
              <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                {questions.map((qq, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">Q{i + 1}:</span> {qq.statement} →{" "}
                    <strong>{qq.answer}</strong>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function makeQuiz(n: number) {
  const out: Array<{ statement: string; answer: EntryKey }> = [];
  for (let i = 0; i < n; i++) {
    const ex = makeScenario(i % 3 === 0 ? "difficile" : i % 2 === 0 ? "moyen" : "facile");
    out.push({ statement: ex.statement, answer: ex.key });
  }
  return out;
}

// Explications pédagogiques
function makeExplanation(chosen: EntryKey, correct: EntryKey, statement: string) {
  if (chosen === correct) {
    return (
      explainRule(correct) +
      " — Indices dans l'énoncé : " +
      extractHints(statement).join(", ")
    );
  }
  return (
    `Tu as choisi ${chosen}, mais la bonne réponse est ${correct}. ` +
    explainContrast(chosen, correct) +
    " Indices : " +
    extractHints(statement).join(", ")
  );
}

function explainRule(key: EntryKey) {
  switch (key) {
    case "FNP":
      return "FNP = charge de N dont la facture arrive en N+1 (4081 au crédit, charge + TVA à débiter)";
    case "AAR":
      return "AAR = avoir fournisseur à recevoir (4098 au débit, on réduit une charge + TVA)";
    case "CCA":
      return "CCA = charge facturée/payée en N couvrant N+1 → on rattache la part N+1 en 486/6xxx";
    case "FAE":
      return "FAE = vente/prestation de N facturée en N+1 (4181 au débit, produit + TVA au crédit)";
    case "AAE":
      return "AAE = avoir client à établir (4198 au crédit, on réduit un produit + TVA)";
    case "PCA":
      return "PCA = produit facturé en N couvrant N+1 → on rattache la part N+1 en 7xxx/487";
    default:
      return "";
  }
}

function explainContrast(chosen: EntryKey, correct: EntryKey) {
  const isCharge = (k: EntryKey) => k === "FNP" || k === "AAR" || k === "CCA";
  const isProduit = (k: EntryKey) => k === "FAE" || k === "AAE" || k === "PCA";

  if (isCharge(chosen) && isProduit(correct)) {
    return "Tu as choisi un modèle lié aux charges, alors que l'énoncé parle d'une vente/produit.";
  }
  if (isProduit(chosen) && isCharge(correct)) {
    return "Tu as choisi un modèle lié aux produits, alors que l'énoncé parle d'une charge.";
  }

  const map: Record<string, string> = {
    "FNP→FAE":
      "FNP = facture fournisseur non parvenue (charge). FAE = facture client à établir (vente).",
    "FAE→FNP":
      "FAE = vente à facturer. FNP = facture fournisseur non parvenue (charge).",
    "AAR→AAE":
      "AAR = avoir à recevoir d'un fournisseur (charge). AAE = avoir à établir pour un client (produit).",
    "AAE→AAR":
      "AAE = avoir client à établir (produit). AAR = avoir fournisseur à recevoir (charge).",
    "CCA→PCA":
      "CCA = charges constatées d'avance (486/6xxx). PCA = produits constatés d'avance (7xxx/487).",
    "PCA→CCA":
      "PCA = produits constatés d'avance (7xxx/487). CCA = charges constatées d'avance (486/6xxx).",
  };

  const key = `${chosen}→${correct}`;
  return map[key] || "Rappel : " + explainRule(correct);
}

function extractHints(statement: string) {
  const s = statement.toLowerCase();
  const hints: string[] = [];
  if (
    s.includes("vente") ||
    s.includes("client") ||
    s.includes("abonnement logiciel")
  )
    hints.push("produit/vente");
  if (
    s.includes("charge") ||
    s.includes("assurance") ||
    s.includes("prestataire") ||
    s.includes("fournisseur")
  )
    hints.push("charge");
  if (s.includes("avoir")) hints.push("avoir");
  if (
    s.includes("facture sera reçue") ||
    s.includes("non facturée") ||
    s.includes("à établir") ||
    s.includes("à facturer")
  )
    hints.push("décalage de facturation N→N+1");
  if (s.includes("couvrant") || s.includes("période")) hints.push("prorata N/N+1");
  return hints.length ? hints : ["relire : charge vs produit, facture reçue/à établir, et prorata"];
}