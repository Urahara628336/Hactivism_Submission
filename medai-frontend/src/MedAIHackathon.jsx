import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf"; 
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const TEXT_ENDPOINT = "https://iatrochemical-lated-lera.ngrok-free.dev/webhook/e4d3098b-ce6e-48c4-8bfc-29dd3cb84a04";

/* ---------- Helpers ---------- */
function cleanServerText(data) {
  try {
    if (Array.isArray(data)) return data.map(cleanServerText).join("\n\n");
    if (typeof data === "object" && data !== null) {
      const keys = ["output", "reply", "summary", "message", "result", "content"];
      for (const k of keys) if (data[k]) return cleanServerText(data[k]);
      data = JSON.stringify(data);
    }
    return String(data)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, " ")
      .replace(/(^\s*["'\[{]+|\s*["'\]}]+$)/g, "")
      .replace(/[<>$%]/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return String(data);
  }
}

async function callTextAPI(prompt, meta = "") {
  const res = await fetch(TEXT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt, meta }),
  });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) return cleanServerText(await res.json());
  return cleanServerText(await res.text());
}

function downloadTextAsPDF(text, filename = "personalized-summary.pdf") {
  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const maxLineWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const lineHeight = 16;
    const lines = doc.splitTextToSize(text, maxLineWidth);
    let y = margin;
    doc.setFontSize(12);
    lines.forEach(line => {
      if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    });
    doc.save(filename);
  } catch (err) {
    console.error(err);
  }
}
import jsPDF from "jspdf";

/** Download personalized summary as PDF with patient info */
function downloadPersonalizedSummaryPDF(summaryText, patient) {
  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const lineHeight = 16;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxLineWidth = pageWidth - margin * 2;

    // Prepare text
    const header = `Name: ${patient.name || "N/A"}\nAge: ${patient.age || "N/A"}\nSex: ${patient.sex || "N/A"}\n\n`;
    const fullText = header + summaryText;

    // Split into lines that fit page width
    const lines = doc.splitTextToSize(fullText, maxLineWidth);

    let cursorY = margin;
    doc.setFontSize(12);

    lines.forEach((line) => {
      if (cursorY + lineHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, margin, cursorY);
      cursorY += lineHeight;
    });

    // Save the PDF
    const filename = `MedIntel_Personalized_Summary_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error("PDF generation failed:", err);
    alert("⚠️ Could not generate PDF. Please try again.");
  }
}

/* ---------- Main Component ---------- */
export default function MedIntel() {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [patient, setPatient] = useState({ name: "", age: "", sex: "Female" });
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const addMessage = (role, text) =>
    setMessages((m) => [...m, { role, text, time: new Date().toLocaleTimeString() }]);

  const buildMeta = () =>
    `Patient: ${patient.name || "N/A"} | Age: ${patient.age || "N/A"} | Sex: ${patient.sex}`;


  

  /* ---------- Chat ---------- */
  const sendText = async () => {
    if (!input.trim()) return;
    const msg = input.trim();
    addMessage("user", msg);
    setInput("");
    setLoading(true);
    setGenerating(true);
    try {
      const reply = await callTextAPI(msg, buildMeta());
      addMessage("bot", reply || "No reply.");
    } catch (err) {
      addMessage("bot", "⚠️ Could not connect to servers.");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  /* ---------- Personalized Summary ---------- */
async function personalizedSummary() {
  setGenerating(true);
  try {
    const prompt = "Give me my personalized health summary based on all of my concerns.";
    const reply = await callTextAPI(prompt, buildMeta());
    const cleaned = reply || "No summary generated.";
    addMessage("bot", cleaned);

    // Generate PDF
    downloadPersonalizedSummaryPDF(cleaned, patient);

  } catch (err) {
    addMessage("bot", "⚠️ Could not generate summary.");
  } finally {
    setGenerating(false);
  }
}


  const LoadingDots = ({ show }) =>
    show ? <span className="inline-block ml-2 animate-pulse">Generating...</span> : null;

  /* ---------- UI ---------- */
  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 to-white">
        <div className="bg-white/90 backdrop-blur-md p-12 rounded-3xl shadow-xl text-center max-w-md border border-slate-200">
          <h1 className="text-5xl font-bold text-sky-600 mb-4">MedIntel</h1>
          <p className="text-slate-600 mb-8">AI-assisted medical guidance & personalized health summaries</p>
          <button
            onClick={() => setStarted(true)}
            className="px-8 py-3 rounded-xl bg-sky-600 text-white text-lg font-semibold shadow hover:bg-sky-700 transition"
          >
            Start Consultation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full grid grid-cols-12 bg-gradient-to-b from-sky-50 to-white p-6 gap-6">
      {/* Sidebar */}
      <aside className="col-span-3 bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-lg border border-slate-100 flex flex-col justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-sky-700 mb-2">MedIntel</h1>
          <p className="text-sm text-slate-500 mb-6">Smart medical insights</p>

          {/* Patient Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Patient Info</h3>
            <input
              value={patient.name}
              onChange={(e) => setPatient({ ...patient, name: e.target.value })}
              placeholder="Full name"
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-sky-400 outline-none"
            />
            <div className="flex gap-2">
              <input
                value={patient.age}
                onChange={(e) => setPatient({ ...patient, age: e.target.value })}
                placeholder="Age"
                className="w-1/2 p-2 border rounded-lg focus:ring-2 focus:ring-sky-400 outline-none"
              />
              <select
                value={patient.sex}
                onChange={(e) => setPatient({ ...patient, sex: e.target.value })}
                className="w-1/2 p-2 border rounded-lg focus:ring-2 focus:ring-sky-400 outline-none"
              >
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          {/* Sidebar Buttons */}
          <nav className="mt-6 flex flex-col gap-3">
            <button
              onClick={personalizedSummary}
              className="p-3 rounded-xl font-medium transition transform hover:scale-[1.03] bg-emerald-600 text-white shadow hover:bg-emerald-700"
            >
              🧠 Personalized Summary
            </button>
          </nav>
        </div>

        <div className="mt-6 text-xs text-slate-400">MedIntel provides educational insights — not a medical diagnosis.</div>
      </aside>

      {/* Main Chat */}
      <main className="col-span-9 bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg border border-slate-100 flex flex-col overflow-hidden">
        <header className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-700">Conversation</h2>
            <div className="text-sm text-slate-500 mt-1">Describe symptoms to get guidance.</div>
          </div>
          <div className={`text-sm px-3 py-1 rounded-lg ${generating ? "bg-yellow-100 text-yellow-700" : "bg-emerald-50 text-emerald-700"}`}>
            {generating ? <LoadingDots show={generating} /> : "Ready"}
          </div>
        </header>

        <section ref={chatRef} className="flex-1 p-6 overflow-auto space-y-5 bg-slate-50/40">
          {messages.length === 0 && (
            <div className="text-center text-slate-400 mt-16">Start your consultation by typing symptoms or concerns.</div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] p-4 rounded-2xl ${m.role === "user" ? "bg-sky-600 text-white shadow-md" : "bg-white text-slate-800 border"}`}>
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                <div className="text-[11px] text-slate-400 mt-2">{m.time}</div>
              </div>
            </div>
          ))}
        </section>

        <footer className="p-4 border-t bg-white flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
            placeholder="Type symptoms, e.g. 'severe headache and nausea'"
            className="flex-1 p-3 rounded-lg border focus:ring-2 focus:ring-sky-400 outline-none transition"
          />
          <button onClick={sendText} disabled={loading} className="px-6 py-3 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 transition">
            {loading ? "Sending..." : "Send"}
          </button>
        </footer>
      </main>
    </div>
  );
}
