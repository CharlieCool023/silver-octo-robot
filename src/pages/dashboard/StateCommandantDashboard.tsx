import { useState } from "react";
import { useSearchParams } from "react-router";
import { motion } from "framer-motion";
import {
  Users, BookOpen, Printer, Search, Eye, ArrowLeft, Shield,
  CheckCircle, XCircle,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/providers/trpc";
import { useScrollPosition } from "@/hooks/useScrollPosition";

type Tab = "dashboard" | "members" | "batches" | "print";

export default function StateCommandantDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") || "dashboard") as Tab;
  const setTab = (t: Tab) => setSearchParams({ tab: t });

  return (
    <DashboardLayout requiredRole="state_commandant" title={tab === "dashboard" ? "State Commandant" : tab.charAt(0).toUpperCase() + tab.slice(1)}>
      {tab === "dashboard" && <DashboardOverview onNavigate={setTab} />}
      {tab === "members" && <MembersTab />}
      {tab === "batches" && <BatchesTab />}
      {tab === "print" && <PrintTab />}
    </DashboardLayout>
  );
}

function DashboardOverview({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { data: stats } = trpc.stats.dashboard.useQuery();

  const cards = [
    { label: "Corps Members", value: stats?.totalCorpsMembers || 0, icon: <Users className="w-6 h-6" />, color: "bg-blue-500", tab: "members" as Tab },
    { label: "Total Batches", value: stats?.totalBatches || 0, icon: <BookOpen className="w-6 h-6" />, color: "bg-amber-500", tab: "batches" as Tab },
    { label: "Print Reports", value: "View", icon: <Printer className="w-6 h-6" />, color: "bg-purple-500", tab: "print" as Tab },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-blue-700 text-sm font-medium flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Read-only access. You can view reports and data but cannot modify them.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <motion.button
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onNavigate(card.tab)}
            className="bg-white rounded-xl p-6 shadow-sm border text-left hover:shadow-md transition-shadow"
          >
            <div className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center text-white mb-4`}>{card.icon}</div>
            <p className="text-2xl font-bold text-gray-800">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function MembersTab() {
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const scrollContainerRef = useScrollPosition({ key: "state-commandant-members-list" });

  const { data: members } = trpc.corpsMembers.list.useQuery({
    search: search || undefined,
    limit: 50,
  });

  const { data: memberDetail } = trpc.corpsMembers.get.useQuery(
    { id: selectedMember! },
    { enabled: !!selectedMember }
  );

  if (selectedMember && memberDetail) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedMember(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to list
        </button>
        <MemberDetailView member={memberDetail} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col max-h-[calc(100vh-240px)]">
        <div ref={scrollContainerRef} className="overflow-y-auto flex-1">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">State Code</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platoon</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PI</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MOW</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {members?.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.surname} {m.otherNames}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.stateCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Platoon {m.platoon}</td>
                    <td className="px-4 py-3">{m.evaluationStatus.platoonInstructor ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}</td>
                    <td className="px-4 py-3">{m.evaluationStatus.manOWar ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}</td>
                    <td className="px-4 py-3"><button onClick={() => setSelectedMember(m.id)} className="text-blue-600 hover:text-blue-700"><Eye className="w-4 h-4" /></button></td>
                  </tr>
                )) || <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No members found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberDetailView({ member }: { member: any }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex items-start gap-4">
          {member.member.passportPhoto ? (
            <img src={member.member.passportPhoto} alt="" className="w-24 h-24 rounded-lg object-cover border" />
          ) : (
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center"><Users className="w-10 h-10 text-gray-400" /></div>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800">{member.member.surname} {member.member.otherNames}</h2>
            <p className="text-gray-500">{member.member.stateCode} | {member.member.callUpNumber}</p>
            <p className="text-gray-500">Platoon {member.member.platoon}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-semibold text-gray-800 mb-4">Platoon Instructor Evaluation</h3>
          {member.piEvaluation ? (
            <div className="space-y-2 text-sm">
              {Object.entries({
                "Leadership & Initiative": member.piEvaluation.leadershipInitiative,
                "Professional Bearing": member.piEvaluation.professionalBearing,
                "Physical Fitness": member.piEvaluation.physicalFitness,
                "Communication Skills": member.piEvaluation.communicationSkills,
                "Technical Competence": member.piEvaluation.technicalCompetence,
                "Teamwork & Cooperation": member.piEvaluation.teamworkCooperation,
                "Reliability & Dependability": member.piEvaluation.reliabilityDependability,
                "Respect for Dignity & Rights": member.piEvaluation.respectDignityRights,
              }).map(([label, score]) => (
                <div key={label} className="flex justify-between"><span>{label}</span><span className="font-medium">{String(score)}/10</span></div>
              ))}
              <div className="flex justify-between pt-2 border-t font-bold"><span>Overall</span><span className="text-green-600">{member.piEvaluation.overallAverage}</span></div>
            </div>
          ) : <p className="text-gray-400 text-sm">Not evaluated yet</p>}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-semibold text-gray-800 mb-4">Man O'War Evaluation</h3>
          {member.mowEvaluation ? (
            <div className="space-y-2 text-sm">
              {Object.entries({
                "Leadership & Initiative": member.mowEvaluation.leadershipInitiative,
                "Professional Bearing": member.mowEvaluation.professionalBearing,
                "Physical Fitness": member.mowEvaluation.physicalFitness,
                "Communication Skills": member.mowEvaluation.communicationSkills,
                "Technical Competence": member.mowEvaluation.technicalCompetence,
                "Teamwork & Cooperation": member.mowEvaluation.teamworkCooperation,
                "Reliability & Dependability": member.mowEvaluation.reliabilityDependability,
                "Respect for Dignity & Rights": member.mowEvaluation.respectDignityRights,
              }).map(([label, score]) => (
                <div key={label} className="flex justify-between"><span>{label}</span><span className="font-medium">{String(score)}/10</span></div>
              ))}
              <div className="flex justify-between pt-2 border-t font-bold"><span>Overall</span><span className="text-green-600">{member.mowEvaluation.overallAverage}</span></div>
            </div>
          ) : <p className="text-gray-400 text-sm">Not evaluated yet</p>}
        </div>
      </div>

      {member.comments?.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-semibold text-gray-800 mb-4">Soldier Comments</h3>
          <div className="space-y-3">
            {member.comments.map((c: any) => (
              <div key={c.id} className="bg-gray-50 rounded-lg p-3 text-sm"><p className="text-gray-700">{c.comment}</p></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BatchesTab() {
  const { data: batches } = trpc.batches.list.useQuery();

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-6 py-4 border-b"><h3 className="font-semibold text-gray-800">All Batches</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {batches?.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{b.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{b.year}</td>
                <td className="px-4 py-3 text-sm text-gray-600 capitalize">{b.state}</td>
                <td className="px-4 py-3">{b.isActive ? <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Active</span> : <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Inactive</span>}</td>
              </tr>
            )) || <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No batches found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrintTab() {
  const { data: members } = trpc.corpsMembers.list.useQuery({});

  return (
    <div className="space-y-6">
      <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors no-print">
        <Printer className="w-4 h-4" /> Print Report
      </button>

      <div className="bg-white rounded-xl shadow-sm border p-6 print:shadow-none">
        <div className="text-center mb-6">
          <Shield className="w-10 h-10 text-green-700 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-gray-800">NYSC State Commandant Report</h2>
          <p className="text-gray-500">Official Evaluation Summary</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">State Code</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platoon</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PI</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MOW</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {members?.map((m, i) => (
                <tr key={m.id}><td className="px-4 py-3 text-sm">{i + 1}</td><td className="px-4 py-3 text-sm font-medium">{m.surname} {m.otherNames}</td><td className="px-4 py-3 text-sm">{m.stateCode}</td><td className="px-4 py-3 text-sm">{m.platoon}</td><td className="px-4 py-3 text-sm">{m.evaluationStatus.piScore || "-"}</td><td className="px-4 py-3 text-sm">{m.evaluationStatus.mowScore || "-"}</td></tr>
              )) || <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No data</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-8 pt-4 border-t text-center">
          <p className="text-sm text-gray-500">Signed by State Commandant</p>
          <div className="mt-4 h-16" />
          <p className="text-sm font-medium">_______________________</p>
          <p className="text-xs text-gray-400 mt-1">Signature & Date</p>
        </div>
      </div>
    </div>
  );
}
