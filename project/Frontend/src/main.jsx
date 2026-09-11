import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {BrowserRouter,useNavigate,useLocation,Routes,Route,NavLink} from "react-router-dom";
import * as I from "lucide-react";
import "./styles.css";

const C={blue:"#2742c7",green:"#18bd83"};

function Header({section="Learn"}){return <div className="topbar">
  <div className="brand"><div className="logo">▧</div><div><div className="brandname">AdaptLearn</div><div className="subtitle">{section}</div></div></div>
  <div className="access">☀︎•</div><div className="avatar"/>
</div>}

function BottomNav(){
 const loc=useLocation();
 const items=[["/upload","Upload",I.CloudUpload],["/learn","Learn",I.BookOpen],["/practice","Practice",I.BadgeHelp],["/progress","Progress",I.BarChart3]];
 return <div className="bottom">{items.map(([to,t,Icon])=><NavLink key={to} to={to} className={({isActive})=>"nav "+(isActive||loc.pathname==="/"&&to==="/learn"?"active":"")}><Icon/><span>{t}</span></NavLink>)}</div>
}

function Layout({children,section}){return <div className="app"><div className="phone"><Header section={section}/>{children}<BottomNav/></div></div>}

function Upload(){
 const nav=useNavigate(); const [tab,setTab]=useState("upload"); const [file,setFile]=useState(""); const [ready,setReady]=useState(false);
 return <Layout section="Upload"><div className="page">
   <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700,color:"#2440c6",paddingTop:4}}><b>Step 1 of 3</b><span style={{color:"#4e5265",fontWeight:500}}>Setup & Adapt Engine</span></div>
   <div style={{display:"flex",gap:0,marginTop:9,fontSize:10,fontWeight:800,color:"#2742c7"}}><div style={{width:"33.33%",textAlign:"center",borderTop:"4px solid #2941c8",paddingTop:9}}>1. Upload</div><div style={{width:"33.33%",textAlign:"center",borderTop:"4px solid #2941c8",paddingTop:9}}>2. Extracted</div><div style={{width:"33.33%",textAlign:"center",borderTop:"4px solid #2941c8",paddingTop:9,color:"#202333"}}>3. Profile</div></div>
   <div className="card" style={{marginTop:15,padding:"17px 15px",background:"#f0f1ff",border:0}}><div style={{fontWeight:800,fontSize:14}}>▣ &nbsp; Add Learning Material</div><p style={{fontSize:12,lineHeight:1.75,margin:"4px 0 0",color:"#4e5265"}}>Turn dense academic documents<br/>into calm, accessible, cognitive-<br/>friendly bite chunks.</p></div>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,background:"#e8e9f7",borderRadius:10,padding:3,marginTop:15}}>{["Upload Document","Paste Raw Text"].map((x,i)=><button onClick={()=>setTab(i?"text":"upload")} key={x} style={{border:0,borderRadius:8,padding:"11px 4px",background:tab===(i?"text":"upload")?"#fff":"transparent",color:tab===(i?"text":"upload")?"#2440c6":"#3f4352",fontSize:11,fontWeight:700}}>{i?"≡ ":"♧ "}{x}</button>)}</div>
   <div className="card" style={{marginTop:14,padding:"12px 14px"}}>
    <div style={{display:"inline-block",fontSize:9,background:"#eefcf7",borderRadius:20,padding:"6px 10px",color:"#394253"}}>✓ Client-side PDF.js + /extract with OCR fallback</div>
    {tab==="upload"?<label style={{marginTop:12,minHeight:205,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><input type="file" className="hidden" accept=".pdf,.docx,.epub,.txt" onChange={e=>setFile(e.target.files?.[0]?.name||"")}/><div style={{width:47,height:47,borderRadius:"50%",background:"#e1e5ff",display:"grid",placeItems:"center",color:"#2b43c9",fontSize:22}}>▱</div><b style={{fontSize:13,marginTop:11}}>{file||"Drag file or tap to browse"}</b><span style={{fontSize:9,marginTop:5}}>Supports PDF, DOCX, EPUB, TXT (up to 45MB)</span><span style={{marginTop:13,background:"#4157dc",color:"#fff",padding:"10px 16px",borderRadius:7,fontSize:11,fontWeight:800}}>⊕ &nbsp;Select From Device</span></label>:<textarea placeholder="Paste raw text here..." style={{width:"100%",height:205,border:0,outline:0,resize:"none",marginTop:14,fontSize:12}}/>}
    <div style={{background:"#eef0ff",borderRadius:6,padding:"7px 9px",fontSize:9,fontWeight:700}}><span>⚙ Processing & Chunking Buffer</span><span style={{float:"right",color:"#007d57"}}>{ready?"100% Ready":"100% Ready"}</span><div style={{height:5,background:"#dce0f4",borderRadius:5,marginTop:5}}><div style={{width:"100%",height:"100%",background:"#18bd83",borderRadius:5}}/></div></div>
   </div>
   <div className="card" style={{marginTop:15,padding:"14px"}}>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:10}}><b>Sample Curriculums</b><span>Tap to swap demo text</span></div>
    <div style={{background:"#e9ebff",borderRadius:8,padding:9,display:"flex",gap:9,alignItems:"center"}}><span style={{background:"#ffd9d3",borderRadius:5,padding:7,color:"#d74437"}}>▣</span><div style={{fontSize:10,flex:1}}><b>Biology 101: Cell Membranes.pdf</b><div style={{fontSize:8,marginTop:3}}>Academic text • 3 sections detected</div></div><span style={{color:"#2941c8"}}>●</span></div>
    <div style={{display:"flex",gap:9,alignItems:"center",padding:"12px 4px 5px"}}><span style={{background:"#eef0ff",borderRadius:5,padding:7}}>▤</span><div style={{fontSize:9}}><b>Economics_Ch4_SupplyDemand.txt</b><div style={{fontSize:8,marginTop:3}}>PlainText file • 820 words</div></div><span>○</span></div>
   </div>
   <div className="card" style={{marginTop:15,padding:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><b style={{fontSize:11}}>▣ Extraction Diagnostics</b><span className="pill" style={{background:"#9bf1c8",fontSize:9,padding:"5px 8px"}}>Verified Clean</span></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:12}}>
      {[[["Word Count","1,420"],["tokens: ~1.8k"]],[["Pacing Est.","6 min"],["calm","cadence"]],[["Readability","Grade","11"],["Flesch-","Kincaid"]]].map((a,i)=><div key={i} style={{background:"#f0f1ff",borderRadius:6,padding:"10px 5px",textAlign:"center",fontSize:8}}><div>{a[0][0]}</div><b style={{display:"block",fontSize:i===1?15:15,color:i===1?"#00865c":i===2?"#a14d19":"#202333",marginTop:5}}>{a[0][1]} {a[0][2]||""}</b><div>{a[1][0]}<br/>{a[1][1]||""}</div></div>)}
    </div>
    <div style={{background:"#e9ebff",padding:"9px",borderRadius:5,marginTop:10,fontSize:9,lineHeight:1.5}}><b>Text Ingestion Sample:</b><span style={{float:"right",color:"#2941c8"}}>Chunk 1 of 4</span><i style={{display:"block",marginTop:4}}>“The plasma membrane consists of a phospholipid bilayer with embedded…”</i></div>
   </div>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:15}}>
    <div>
      <b style={{fontSize:15}}>Learner Profile</b>{" "}
      <span style={{fontSize:9,background:"#e8ebff",borderRadius:10,padding:"3px 6px",color:"#2941c8"}}>3</span>
      <div style={{fontSize:9,marginTop:4}}>
        Pick the cognitive visual scaffolding that<br/>matches your brain today.
      </div>
    </div>
    <button
      onClick={()=>nav("/profile")}
      style={{
        border:0,
        background:"none",
        color:"#2941c8",
        fontWeight:800,
        fontSize:9,
        cursor:"pointer"
      }}
    >
      Customize
    </button>
   </div>
   <ProfileCards compact/>
   <div style={{background:"#e7e9fb",borderRadius:8,padding:"10px",marginTop:10,fontSize:9}}><b>⚡ Groq Adaptive Engine v3.4 Ready</b><div style={{fontSize:8,marginTop:2}}>Pre-cached variants: Simplified, Real-life Metaphors, Audio in SQLite</div></div>
   <button onClick={()=>nav("/profile")} style={{width:"100%",border:0,borderRadius:7,background:"#3e54d7",color:"#fff",fontWeight:800,padding:"12px",marginTop:9,fontSize:11}}>✦ &nbsp; Transform & Adapt with Groq Intelligence</button>
   <div style={{fontSize:8,textAlign:"center",margin:"8px 0 2px"}}>Zero data retained for training • Instant offline fallbacks supported</div>
 </div></Layout>
}

function ProfileCards({compact=false}){
 const data=[
 ["Dyslexia Support Mode","OpenDyslexic optical weighting, +30% letter tracking, syllable color split, and optional bionic reading anchors.","Heavy-bottom letters","No crowding"],
 ["Low Vision & Clarity","Max optical disambiguation, strict 7:1 contrast boundaries, TTS audio companion, screen-reader optimized landmarks.","High contrast","Screen reader sync"],
 ["Cognitive Load Support","Single-concept progressive chunks, plain-language translations, visual memory anchors, zero peripheral clutter.","1 Concept / Screen","Memory Anchors"],
 ["ADHD & Executive Focus","Interactive horizontal reading ruler line, 10-minute micro sprints, ambient pink noise soundbed, micro-checklists.","Interactive Ruler","Micro-sprints"]
 ];
 return <div style={{marginTop:8,display:"grid",gap:9}}>{data.map((d,i)=><div key={d[0]} className="card" style={{padding:"13px 14px",background:i===0?"#f0f1ff":"#fff",boxShadow:i===0?"0 4px 10px rgba(40,42,70,.10)":"none"}}>
  <div style={{display:"flex",alignItems:"flex-start",gap:10}}><div style={{width:17,height:17,borderRadius:"50%",border:i===0?"4px solid #2941c8":"0",background:i===0?"#fff":"#e9ebfa",flexShrink:0,marginTop:2}}/><div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between"}}><b style={{fontSize:11,color:i===2?"#2742c7":"#202333"}}>{d[0]}</b>{i===1&&<span className="pill" style={{padding:"3px 7px",background:"#f0f0f7",fontSize:8}}>20pt Scalable</span>}{i===2&&<span className="pill" style={{padding:"3px 7px",background:"#91efc3",fontSize:8}}>Recommended</span>}{i===3&&<span className="pill" style={{padding:"3px 7px",background:"#ffdbc9",fontSize:8}}>Focus Ruler</span>}</div><p style={{fontSize:9,lineHeight:1.65,color:"#4e5265",margin:"5px 0 6px"}}>{d[1]}</p><span className="pill" style={{padding:"4px 7px",fontSize:7,background:"#e9ebff"}}>{d[2]}</span> <span className="pill" style={{padding:"4px 7px",fontSize:7,background:i===2?"#91efc3":"#e9ebff"}}>{d[3]}</span></div></div>
 </div>)}</div>
}

function Profile(){const nav=useNavigate();return <Layout section="Upload"><div className="page">
 <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700,color:"#2440c6",paddingTop:4}}><b>Step 3 of 3</b><span style={{color:"#4e5265",fontWeight:500}}>Profile</span></div>
 <div className="card" style={{marginTop:15,padding:17,background:"#f0f1ff",border:0}}><b style={{fontSize:14}}>Learner Profile</b><p style={{fontSize:12,lineHeight:1.7,margin:"5px 0 0"}}>Pick the cognitive visual scaffolding that matches your brain today.</p></div>
 <ProfileCards/>
 <div style={{background:"#e7e9fb",borderRadius:8,padding:12,marginTop:10,fontSize:9}}><b>⚡ Groq Adaptive Engine v3.4 Ready</b><div style={{fontSize:8,marginTop:3}}>Pre-cached variants: Simplified, Real-life Metaphors, Audio in SQLite</div></div>
 <button onClick={()=>nav("/learn")} style={{width:"100%",border:0,borderRadius:7,background:"#3e54d7",color:"#fff",fontWeight:800,padding:13,marginTop:9,fontSize:11}}>✦ &nbsp; Transform & Adapt with Groq Intelligence</button>
 </div></Layout>}

function Learn(){
 const [playing,setPlaying]=useState(false);
 return <Layout section="Learn"><div className="page">
  <div style={{background:"#f0f0ff",borderRadius:20,padding:"8px 11px",fontSize:11,marginBottom:19,whiteSpace:"nowrap",overflow:"hidden"}}><span style={{color:"#087c5a"}}>●</span> &nbsp; Calibrating dwell time & reread cues <span style={{float:"right",background:"#e4e4f7",borderRadius:15,padding:"5px 9px",fontWeight:800}}>Dyslexia Mode Active</span></div>
  <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><b className="blue">CHUNK 2 OF 5 • CORE BIOLOGY</b><span>~3 min read</span></div>
  <h1 style={{fontSize:25,lineHeight:1.45,letterSpacing:-.6,margin:"8px 0 8px",fontWeight:800}}>Cell Membranes: The Lipid<br/>Bilayer</h1>
  <div className="progressbar" style={{height:8}}><div style={{width:"39%",background:"#3047ca",height:"100%",borderRadius:8}}/></div>
  <div className="card" style={{marginTop:20,padding:"10px 11px",display:"flex",gap:5,alignItems:"center"}}><b style={{fontSize:12}}>Text:</b>{["A−","A+","A♢ Dyslexic Font","▥ Ruler"].map((x,i)=><button key={x} style={{border:0,background:i===2?"#e0e3ff":"#f0f1ff",borderRadius:7,padding:"10px 10px",fontWeight:700,fontSize:11,color:i===2?"#223ec3":"#303445"}}>{x}</button>)}</div>
  <div style={{marginTop:20,background:"#4056d5",borderRadius:14,padding:"17px 20px",color:"#fff"}}>
   <div style={{display:"flex",justifyContent:"space-between"}}><div><b style={{fontSize:13}}>♧ &nbsp; Calm Assist Voice</b><div style={{fontSize:11}}>Web Speech API • Humanist tone</div></div><button onClick={()=>setPlaying(!playing)} style={{border:0,borderRadius:15,background:"#2742bd",color:"#fff",padding:"7px 11px",fontWeight:800}}>{playing?"◼":"◉"} 1.0x</button></div>
   <div style={{display:"flex",alignItems:"center",gap:12,marginTop:18}}><button onClick={()=>setPlaying(!playing)} style={{width:49,height:49,border:0,borderRadius:"50%",background:"#fff",color:"#2942c7",fontSize:21}}>{playing?"Ⅱ":"▶"}</button><div style={{height:33,flex:1,borderRadius:8,background:"#2944c5",display:"flex",alignItems:"center",justifyContent:"center",letterSpacing:4}}>▮▮▮▮▮▮▮▮▮</div></div>
   <div style={{height:6,borderRadius:8,background:"#dfe5ff",marginTop:18}}><div style={{width:"43%",height:"100%",background:"#fff",borderRadius:8}}/></div><div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginTop:6}}>01:14<span>02:45</span></div>
  </div>
  <div className="card" style={{marginTop:20,padding:"20px 12px 16px",position:"relative"}}>
   <div style={{display:"inline-block",background:"#e7e9fb",borderRadius:5,padding:"5px 8px",fontSize:10,color:"#41455a"}}>▤ Key Structural Principle</div>
   <div style={{height:1}}/>
   <div style={{height:76}}/>
   <div style={{position:"absolute",top:76,left:12,right:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}><button style={{border:0,background:"#e7e9fb",borderRadius:11,padding:"14px 17px",fontSize:11}}>♧ Ask Assistant</button><button style={{border:0,background:"#e7e9fb",borderRadius:10,padding:"14px",fontSize:13,color:"#a24716"}}>⚑</button><button style={{border:0,background:"#2340c7",color:"#fff",borderRadius:12,padding:"15px 18px",fontSize:15,boxShadow:"0 4px 7px #ccc"}}>Test Chunk<br/>2　→</button></div>
   <div style={{fontSize:17,lineHeight:1.7,padding:"0 8px"}}>layered sheet known as the <b className="blue">lipid<br/>bilayer.</b></div>
   <div style={{background:"#f0f1ff",borderRadius:12,padding:"12px 14px",margin:"13px 8px 0",fontSize:16,lineHeight:1.65}}>🔊 Phospholipids have a <b style={{background:"#dfe3ff",padding:"2px 5px"}}>hydrophilic (water-loving)</b> head and two hydrophobic tails that naturally turn away from liquid.</div>
   <p style={{fontSize:16,lineHeight:1.75,padding:"0 8px"}}>Because both the interior and exterior of living organisms are water-based environments, these unique molecules self-assemble into two opposing rows.</p>
   <div style={{background:"#e8eaff",borderRadius:12,padding:"17px 20px",margin:"14px 8px"}}>
    <h3 style={{fontSize:18,margin:0}}>💡 Visual Metaphor: The<br/>Sandwich Model</h3><p style={{fontSize:13,lineHeight:1.75,color:"#4e5265"}}>Think of the membrane like an ice cream sandwich: the biscuit heads face the water inside and outside the cell, while the oily tails stay sealed in the middle, away from moisture.</p>
    <div style={{background:"#fff",borderRadius:6,padding:4,fontSize:9,fontWeight:800,textAlign:"center"}}><div style={{background:"#4056d5",color:"#fff",borderRadius:4,padding:5}}>OUTER WATER / HYDROPHILIC HEADS</div><div style={{padding:7,color:"#a44d15"}}>♢ Hydrophobic Tails (Oil Zone)</div><div style={{background:"#4056d5",color:"#fff",borderRadius:4,padding:5}}>INNER WATER / HYDROPHILIC HEADS</div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginTop:10}}><button style={{border:0,background:"#fff",borderRadius:8,padding:12}}>⚙<br/><span style={{fontSize:11}}>Simpler<br/>Words</span></button><button style={{border:0,background:"#fff",borderRadius:8,padding:12}}>⚗<br/><span style={{fontSize:11}}>Real Example</span></button></div>
   </div>
   <div style={{display:"flex",gap:9,background:"#f0f1ff",borderRadius:12,padding:11,margin:"14px 8px 0",fontSize:11}}><div style={{width:63,height:53,borderRadius:7,background:"#ddd"}}/><div><b className="blue">Need a quick break?</b><div style={{lineHeight:1.5}}>Your cognitive dwell pattern shows high effort. Take 20 seconds to blink and stretch.</div></div></div>
  </div>
 </div></Layout>
}

function Practice(){
 const [ans,setAns]=useState("B"); const [submitted,setSubmitted]=useState(true);
 const opts=[["A","They are attracted to water inside the cell."],["B","They avoid water and form a protective barrier against external liquids."],["C","They provide rigid structural bone support."],["D","They produce energy for mitochondria."]];
 return <Layout section="Progress"><div className="page">
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}><span className="pill" style={{background:"#e6e8f8"}}>❔ Chunk 2 • Step 1/2</span><span className="pill" style={{border:"1px solid #ffb62f",background:"#fff7e7",color:"#a04c0f"}}>⚡ +15 XP Earnable</span></div>
  <div className="progressbar" style={{marginTop:10}}><div className="progressfill" style={{width:"50%"}}/></div>
  <div style={{border:"2px solid #ffc447",borderRadius:16,padding:"11px 15px",marginTop:20,color:"#75390e",fontWeight:700,fontSize:12,lineHeight:1.45}}>▰ &nbsp; Mastery Gate Active: Complete both questions accurately to unlock Chunk 3. Skipping is locked until mastered.</div>
  <div className="card" style={{marginTop:24,padding:"22px 23px 17px"}}>
   <div style={{display:"flex",justifyContent:"space-between"}}><span style={{background:"#e4e6f6",borderRadius:7,padding:"7px 11px",fontSize:12,fontWeight:700}}>Concept: Membrane<br/>Orientation</span><button style={{border:"0",background:"#f0f1ff",borderRadius:9,padding:"10px 15px",fontWeight:800,color:"#2942c7"}}>🔊 Listen</button></div>
   <h2 style={{fontSize:21,lineHeight:1.45,margin:"22px 0 37px"}}>Why do the <u className="blue">hydrophobic tails</u> of phospholipids face inwards toward each other?</h2>
   <div style={{display:"grid",gap:10}}>{opts.map(([k,t])=><button key={k} onClick={()=>setAns(k)} style={{textAlign:"left",border:ans===k?"2px solid #1da9e9":"1px solid #e5e5ef",background:ans===k?"#eaf8ff":"#fff",borderRadius:13,padding:"15px 16px",display:"flex",gap:13,alignItems:"flex-start",boxShadow:"0 3px 0 #e5e5ed"}}><span style={{width:35,height:35,borderRadius:12,display:"grid",placeItems:"center",background:ans===k?"#16a9df":"#eef0ff",color:ans===k?"#fff":"#303446",fontWeight:800,flexShrink:0}}>{ans===k?"✓":k}</span><span style={{fontSize:15,lineHeight:1.4,fontWeight:ans===k?700:500}}>{t}{ans===k&&<small style={{display:"block",color:"#0878a9",marginTop:6}}>◉ Selected Answer • Hydrophobic = “water-fearing”</small>}</span></button>)}</div>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:25}}><button style={{border:"1px solid #ffc53e",background:"#fff7dd",borderRadius:12,padding:15,fontWeight:700,color:"#9c4d0d"}}>💡 Hint (1 left)</button><button style={{border:0,background:"#eef0ff",borderRadius:12,padding:15,fontWeight:700,color:"#303b9f"}}>↻ Re-listen<br/>Audio</button></div>
   <div style={{border:"2px solid #ffcf52",borderRadius:12,padding:14,marginTop:22,color:"#8b440f",fontSize:12,lineHeight:1.55}}><b>⚙ Gentle Memory Cue:</b><br/>Think of the heads as umbrellas facing the rain, and the tails as socks hiding safely underneath to stay dry!</div>
  </div>
  <div style={{border:"2px solid #bdc9ff",background:"#edf0ff",borderRadius:15,padding:20,marginTop:24}}>
   <div style={{display:"flex",justifyContent:"space-between"}}><div><b style={{fontSize:14,color:"#22275b"}}>🧠 Adaptive Coach Shield</b><div style={{fontSize:12,color:"#3241dc",marginTop:4}}>Active struggle detection</div></div><span className="pill" style={{background:"#dfe4ff",color:"#3944aa"}}>• Shielded</span></div>
   <div style={{background:"#fff",border:"1px solid #d9ddf7",borderRadius:11,padding:15,marginTop:16,fontSize:12,lineHeight:1.65,color:"#272d80"}}>“We noticed you paused here for 48s — no worries at all! Adaptive Shield activated: here is a free memory power-up and no hearts lost on this check.”</div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:15}}>{[["Dwell Time","48s"],["Re-reads","2"],["Heart Shield","Safe 🛡️"]].map(x=><div key={x[0]} style={{background:"#fff",borderRadius:10,padding:9,textAlign:"center",fontSize:9}}><div>{x[0]}</div><b style={{fontSize:19,color:x[0]==="Heart Shield"?"#079968":"#22264c"}}>{x[1]}</b></div>)}</div>
  </div>
  <div style={{border:"2px solid #53dfae",background:"#eafff5",borderRadius:15,padding:"20px 23px",marginTop:24,marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:48,height:48,borderRadius:15,background:"#13bc80",color:"#fff",display:"grid",placeItems:"center",fontSize:22}}>✓</div><div><b style={{fontSize:17}}>Awesome! 🎉</b><div style={{fontSize:12,color:"#075f46",fontWeight:700}}>+10 XP gained • Concept verified!</div></div><span style={{marginLeft:"auto",width:35,height:35,borderRadius:"50%",background:"#c7f8e4",display:"grid",placeItems:"center"}}>🔊</span></div><button onClick={()=>setSubmitted(!submitted)} style={{width:"100%",marginTop:16,border:0,borderRadius:14,background:"#12bb7f",color:"#fff",padding:"14px",fontSize:16,fontWeight:800,boxShadow:"0 4px 0 #079d6a"}}>CONTINUE 🚀</button><div style={{fontSize:12,marginTop:17}}>🔒 Skipping disabled by Mastery Gate — learn with confidence!</div></div>
 </div></Layout>
}

function Progress(){
 return <Layout section="Progress"><div className="page">
  <div className="pill" style={{background:"#a0f0c7",color:"#07684b",marginTop:2}}>⚙ Session Complete</div>
  <div className="card" style={{marginTop:10,padding:"17px 20px 18px",background:"linear-gradient(120deg,#fff,#effff8)"}}><div style={{float:"right",width:50,height:50,borderRadius:15,background:"#e0e5ff",display:"grid",placeItems:"center",color:"#2842c6"}}>❔</div><h1 style={{fontSize:24,lineHeight:1.5,margin:"8px 0"}}>Biology 101 — Cell<br/>Structure</h1><p style={{fontSize:15,lineHeight:1.8,color:"#4e5265",margin:0}}>Paced mastery session focused on<br/>the phospholipid bilayer.</p></div>
  <div className="card" style={{marginTop:20,padding:20,background:"#e6e8fa",border:0}}><div className="pill" style={{background:"#b65a09",color:"#fff"}}>✣ Smart Adaptation Triggered & Explained</div><div style={{fontSize:11,marginTop:10}}>Real-time Diagnostic</div><div style={{background:"#fff",borderRadius:9,padding:13,marginTop:13}}><div className="blue" style={{fontSize:11}}>♧ Adaptive Rewire Diagnosis</div><p style={{fontSize:15,lineHeight:1.75,fontStyle:"italic",marginBottom:0}}>“You reread the lipid polarity section 3 times and answered 2 questions incorrectly. We rewrote the explanation using a simpler sandwich analogy, added audio assistance, and reduced chunk length from 300 to 120 words.”</p></div><div style={{background:"#f0f1ff",borderRadius:9,padding:12,marginTop:12,textAlign:"center",fontSize:12,fontWeight:700}}>▥ &nbsp; Why this helped: Cognitive Load Reduction　⌄</div></div>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:25}}><h2 style={{fontSize:19,margin:0}}>Session Analytics</h2><span style={{fontSize:10,color:"#007b57"}}>● Live Telemetry</span></div>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginTop:8}}>{[["+28%","Comprehension Gain","52% initial → 80% final"],["Low","Cognitive Fatigue","Paced Chunks applied"],["3 Rewires","Adaptations Done","2 Lexical, 1 Audio"],["14 mins","Active Reading","Zero overwhelm"]].map((x,i)=><div key={x[0]} className="card" style={{padding:"14px 12px"}}><div style={{fontSize:20}}>{["↗","♧","☷","◷"][i]}</div><b style={{fontSize:18,color:i===0||i===2?"#087d5a":"#202333"}}>{x[0]}</b><div style={{fontSize:11,fontWeight:700}}>{x[1]}</div><div style={{fontSize:9,marginTop:8}}>{x[2]}</div></div>)}</div>
  <div className="card" style={{marginTop:20,padding:20}}><div className="blue" style={{fontSize:11,fontWeight:700}}>▤ Offline SQLite Storage</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{fontSize:19,margin:"8px 0"}}>Cached Reading<br/>Formats</h2><span style={{background:"#e6e8fa",borderRadius:50,padding:13,fontSize:10}}>Instant<br/>Switch</span></div><p style={{fontSize:11,lineHeight:1.7,color:"#4e5265"}}>4 synchronized representations are preserved locally for revision without network latency.</p>
  {[["Standard Textbook Extract","300 words • Complex terminology","Baseline"],["Metaphorical Rewire (Active)","120 words • Sandwich polar model","Used"],["Dyslexia Lexical Format","Bionic syllables • Generous line gaps","Ready"],["Audio-First Script","Conversational cadence • 0.9x pacing","Ready"]].map((x,i)=><div key={x[0]} style={{display:"flex",alignItems:"center",gap:10,background:"#f0f1ff",borderRadius:7,padding:"11px 9px",marginTop:7}}><div style={{width:30,height:30,borderRadius:6,background:i===1?"#2941c8":"#e0e2f1",display:"grid",placeItems:"center",color:i===1?"#fff":"#555"}}>{["▤","♧","A","♧"][i]}</div><div style={{flex:1}}><b style={{fontSize:11,color:i===1?"#2842c6":"#202333"}}>{x[0]}</b><div style={{fontSize:8,marginTop:3}}>{x[1]}</div></div><span className="pill" style={{fontSize:8,padding:"6px 8px",background:x[2]==="Ready"?"#8fefc2":"#e2e4f6",color:x[2]==="Used"?"#2942c7":"#4e5265"}}>{x[2]}</span></div>)}</div>
  <h2 style={{fontSize:19,margin:"25px 0 8px"}}>Next Steps & Continuity</h2>
  {[["▧","Review Flashcards for Chunk 2","Solidify hydrophilic vs. hydrophobic concepts (4 cards)","›"],["◉","Export Audio Podcast (.mp3)","Offline audio with sandwich model recap (3:12)","⇩"],["→","Begin Next Topic: Passive Transport","Diffusion & Osmosis • 10 min estimated","▷"]].map((x,i)=><button key={x[1]} style={{width:"100%",display:"flex",alignItems:"center",gap:11,textAlign:"left",border:0,borderRadius:11,padding:"13px 12px",marginTop:8,background:i===2?"#2942c8":"#fff",color:i===2?"#fff":"#202333",boxShadow:i===2?"0 4px 7px #cdd":"0 1px 2px #eee"}}><span style={{width:37,height:37,borderRadius:9,background:i===2?"#3854d3":"#f0f1ff",display:"grid",placeItems:"center",fontSize:20}}>{x[0]}</span><span style={{flex:1}}><b style={{fontSize:12}}>{x[1]}</b><div style={{fontSize:9,marginTop:3}}>{x[2]}</div></span><b>{x[3]}</b></button>)}
 </div></Layout>
}

function Dashboard(){return <Layout section="Learn"><div className="page"><div className="card" style={{marginTop:10,padding:20}}><b>AdaptLearn</b><h1 style={{fontSize:24}}>Welcome back</h1><p style={{fontSize:13,color:"#4e5265"}}>Continue your adaptive learning session.</p><NavLink to="/learn" style={{display:"inline-block",background:"#2942c8",color:"#fff",borderRadius:8,padding:"11px 16px",fontSize:12,fontWeight:800,textDecoration:"none"}}>Continue learning →</NavLink></div></div></Layout>}

function App(){return <Routes><Route path="/" element={<Dashboard/>}/><Route path="/upload" element={<Upload/>}/><Route path="/profile" element={<Profile/>}/><Route path="/learn" element={<Learn/>}/><Route path="/practice" element={<Practice/>}/><Route path="/progress" element={<Progress/>}/></Routes>}
createRoot(document.getElementById("root")).render(<BrowserRouter><App/></BrowserRouter>);
