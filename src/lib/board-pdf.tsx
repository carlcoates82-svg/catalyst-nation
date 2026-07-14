import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { money } from "@/lib/domain";
import type { BoardPackData } from "@/lib/board-data";

const KPI_COLS = [16, 18, 18, 18, 30];

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111111" },
  eyebrow: {
    fontSize: 9,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  stageBadge: {
    fontSize: 9,
    borderWidth: 1,
    borderColor: "#9ca3af",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  subtitle: { fontSize: 10, color: "#4b5563", marginBottom: 10 },
  thesis: { fontSize: 10, marginBottom: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#6b7280",
    marginBottom: 6,
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  statBox: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 4, padding: 8 },
  statLabel: { fontSize: 8, color: "#6b7280", marginBottom: 2 },
  statValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  table: { width: "100%" },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 3,
    marginBottom: 3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 3,
  },
  th: { fontSize: 8, color: "#6b7280", textTransform: "uppercase" },
  td: { fontSize: 9 },
  tdMuted: { fontSize: 9, color: "#6b7280" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
  },
  rowLeft: { fontSize: 9 },
  rowLeftBold: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  rowRight: { fontSize: 9, color: "#6b7280" },
  rowRightOver: { fontSize: 9, color: "#92400e", fontFamily: "Helvetica-Bold" },
  listItem: { fontSize: 9, marginBottom: 5 },
  tag: { fontSize: 8, textTransform: "uppercase", color: "#92400e" },
  tagMuted: { fontSize: 8, textTransform: "uppercase", color: "#6b7280" },
  empty: { fontSize: 9, color: "#6b7280" },
});

function colWidth(i: number) {
  return { width: `${KPI_COLS[i]}%` } as const;
}

export function BoardPackDocument({
  venture: v,
  budgets: budgetList,
  kpis: kpiList,
  risks: riskList,
  gates: gateList,
  validation: validationList,
  agents: agentList,
}: BoardPackData) {
  const latestKpi = kpiList[0];
  const totalBudgetAllocated = budgetList.reduce((sum, b) => sum + b.allocated, 0);
  const totalBudgetSpent = budgetList.reduce((sum, b) => sum + b.spent, 0);
  const agentBudgetAllocated = agentList.reduce((sum, a) => sum + a.budget_allocated, 0);
  const agentBudgetSpent = agentList.reduce((sum, a) => sum + a.budget_spent, 0);

  const generatedAt = new Date().toLocaleDateString("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Board pack · Generated {generatedAt}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{v.name}</Text>
          <Text style={styles.stageBadge}>{v.stage}</Text>
        </View>
        <Text style={styles.subtitle}>
          {v.sector ?? "—"} · {v.status}
          {v.founder_ceo ? ` · Founder CEO: ${v.founder_ceo}` : ""}
        </Text>
        {v.thesis ? <Text style={styles.thesis}>{v.thesis}</Text> : null}
        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Traction</Text>
          {latestKpi ? (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>ARR</Text>
                  <Text style={styles.statValue}>{money(latestKpi.arr ?? 0)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Customers</Text>
                  <Text style={styles.statValue}>{String(latestKpi.customers ?? 0)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Pipeline</Text>
                  <Text style={styles.statValue}>{money(latestKpi.pipeline ?? 0)}</Text>
                </View>
              </View>
              {kpiList.length > 1 && (
                <View style={styles.table}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.th, colWidth(0)]}>Date</Text>
                    <Text style={[styles.th, colWidth(1)]}>ARR</Text>
                    <Text style={[styles.th, colWidth(2)]}>Customers</Text>
                    <Text style={[styles.th, colWidth(3)]}>Pipeline</Text>
                    <Text style={[styles.th, colWidth(4)]}>Note</Text>
                  </View>
                  {kpiList.map((k) => (
                    <View style={styles.tableRow} key={k.id}>
                      <Text style={[styles.tdMuted, colWidth(0)]}>{k.as_of}</Text>
                      <Text style={[styles.td, colWidth(1)]}>{money(k.arr ?? 0)}</Text>
                      <Text style={[styles.td, colWidth(2)]}>{k.customers ?? 0}</Text>
                      <Text style={[styles.td, colWidth(3)]}>{money(k.pipeline ?? 0)}</Text>
                      <Text style={[styles.tdMuted, colWidth(4)]}>{k.note ?? ""}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.empty}>No KPIs recorded yet.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget</Text>
          {budgetList.length ? (
            <>
              {budgetList.map((b) => {
                const over = b.allocated > 0 && b.spent > b.allocated;
                return (
                  <View style={styles.row} key={b.id}>
                    <Text style={styles.rowLeft}>{b.phase[0].toUpperCase() + b.phase.slice(1)}</Text>
                    <Text style={over ? styles.rowRightOver : styles.rowRight}>
                      {money(b.spent, b.currency)} / {money(b.allocated, b.currency)}
                      {over ? " · over budget" : ""}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.row}>
                <Text style={styles.rowLeftBold}>Total</Text>
                <Text
                  style={
                    totalBudgetAllocated > 0 && totalBudgetSpent > totalBudgetAllocated
                      ? styles.rowRightOver
                      : styles.rowRight
                  }
                >
                  {money(totalBudgetSpent)} / {money(totalBudgetAllocated)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.empty}>No budgets set.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI agent spend (Paperclip)</Text>
          {agentList.length ? (
            <>
              {agentList.map((a) => {
                const over = a.budget_allocated > 0 && a.budget_spent > a.budget_allocated;
                return (
                  <View style={styles.row} key={a.id}>
                    <Text style={styles.rowLeft}>{a.name}</Text>
                    <Text style={over ? styles.rowRightOver : styles.rowRight}>
                      {money(a.budget_spent, a.currency)} / {money(a.budget_allocated, a.currency)}
                      {over ? " · over budget" : ""}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.row}>
                <Text style={styles.rowLeftBold}>Total</Text>
                <Text
                  style={
                    agentBudgetAllocated > 0 && agentBudgetSpent > agentBudgetAllocated
                      ? styles.rowRightOver
                      : styles.rowRight
                  }
                >
                  {money(agentBudgetSpent)} / {money(agentBudgetAllocated)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.empty}>No agents running for this venture.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open risks</Text>
          {riskList.length ? (
            riskList.map((r) => (
              <Text style={styles.listItem} key={r.id}>
                <Text style={styles.tag}>
                  {r.severity}/{r.likelihood}{"  "}
                </Text>
                {r.description}
                {r.mitigation ? ` — Mitigation: ${r.mitigation}` : ""}
              </Text>
            ))
          ) : (
            <Text style={styles.empty}>None open.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Validation evidence</Text>
          {validationList.length ? (
            validationList.map((val) => (
              <Text style={styles.listItem} key={val.id}>
                <Text style={styles.tagMuted}>{val.kind}{"  "}</Text>
                {val.note}
                {val.willingness_to_pay != null ? ` — WTP ${money(val.willingness_to_pay)}` : ""}
              </Text>
            ))
          ) : (
            <Text style={styles.empty}>None recorded.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gate history</Text>
          {gateList.length ? (
            gateList.map((g) => (
              <Text style={styles.listItem} key={g.id}>
                <Text style={styles.tagMuted}>{g.created_at.slice(0, 10)}{"  "}</Text>
                {g.stage}: {g.decision}
                {g.rationale ? ` — ${g.rationale}` : ""}
              </Text>
            ))
          ) : (
            <Text style={styles.empty}>None recorded.</Text>
          )}
        </View>
      </Page>
    </Document>
  );
}
