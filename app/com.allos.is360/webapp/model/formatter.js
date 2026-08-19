sap.ui.define(function () {
	"use strict";

	const BAND_LABELS = { verde: "Aderente", amarelo: "Atencao", vermelho: "Critico" };
	const BAND_STATES = { verde: "Success", amarelo: "Warning", vermelho: "Error" };
	const BAND_VALUE_COLORS = { verde: "Good", amarelo: "Critical", vermelho: "Error" };
	const SEVERITY_LABELS = { alta: "Alta", media: "Média", baixa: "Baixa" };

	return {
		bandText: function (sBand) {
			return BAND_LABELS[sBand] || "Nao analisado";
		},

		bandState: function (sBand) {
			return BAND_STATES[sBand] || "None";
		},

		bandValueColor: function (sBand) {
			return BAND_VALUE_COLORS[sBand] || "Neutral";
		},

		passedText: function (bPassed) {
			return bPassed ? "Passou" : "Falhou";
		},

		passedState: function (bPassed) {
			return bPassed ? "Success" : "Error";
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
		}
	};
});
