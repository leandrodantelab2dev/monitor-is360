sap.ui.define(function () {
	"use strict";

	const BAND_LABELS = { verde: "Aderente", amarelo: "Atenção", vermelho: "Crítico" };
	const BAND_STATES = { verde: "Success", amarelo: "Warning", vermelho: "Error" };
	const BAND_VALUE_COLORS = { verde: "Good", amarelo: "Critical", vermelho: "Error" };
	const BAND_ICONS = { verde: "sap-icon://status-positive", amarelo: "sap-icon://status-critical", vermelho: "sap-icon://status-negative" };
	const SEVERITY_LABELS = { alta: "Alta", media: "Média", baixa: "Baixa" };

	// Nomes curtos e legiveis por regra, para o grafico "Regras Mais Violadas".
	// Mesmas regras de srv/config/best-practices.json, so reformuladas como violacao.
	const RULE_LABELS = {
		"PKG-01": "Pacote sem descrição",
		"PKG-02": "Nome de pacote fora do padrão",
		"PKG-03": "Pacote sem tags",
		"IFL-01": "iFlow sem descrição",
		"IFL-02": "Versão fora do padrão semântico",
		"BPM-01": "Sem tratamento de erro",
		"BPM-02": "Passos com nome padrão",
		"BPM-03": "Logs não externalizados",
		"BPM-04": "Sem logger de monitoria",
		"BPM-05": "Participantes com nome padrão",
		"BPM-06": "Credenciais não externalizadas",
		"BPM-07": "Adapter descontinuado",
		"SCR-01": "Script com nome padrão",
		"SCR-02": "Import absoluto em script",
		"SCR-03": "Script genérico fora de coleção"
	};

	return {
		bandText: function (sBand) {
			return BAND_LABELS[sBand] || "Não analisado";
		},

		bandState: function (sBand) {
			return BAND_STATES[sBand] || "None";
		},

		bandValueColor: function (sBand) {
			return BAND_VALUE_COLORS[sBand] || "Neutral";
		},

		bandIcon: function (sBand) {
			return BAND_ICONS[sBand] || "sap-icon://question-mark";
		},

		passedIcon: function (bPassed) {
			return bPassed ? "sap-icon://sys-enter-2" : "sap-icon://sys-cancel-2";
		},

		passedIconColor: function (bPassed) {
			return bPassed ? "Positive" : "Negative";
		},

		severityText: function (sSeveridade) {
			return SEVERITY_LABELS[sSeveridade] || sSeveridade;
		},

		compliantIcon: function (iCount) {
			return iCount > 0 ? "sap-icon://status-positive" : "";
		},

		compliantColor: function (iCount) {
			return iCount > 0 ? "Good" : "Neutral";
		},

		ruleLabel: function (sRuleId) {
			return RULE_LABELS[sRuleId] || sRuleId;
		},

		ruleBarTitle: function (sRuleId) {
			const sLabel = RULE_LABELS[sRuleId];
			return sLabel ? `${sRuleId} · ${sLabel}` : sRuleId;
		}
	};
});
