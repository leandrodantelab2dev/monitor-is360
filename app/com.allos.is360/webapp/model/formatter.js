sap.ui.define(function () {
	"use strict";

	const BAND_LABELS = { verde: "Aderente", amarelo: "Atencao", vermelho: "Critico" };
	const BAND_STATES = { verde: "Success", amarelo: "Warning", vermelho: "Error" };

	return {
		bandText: function (sBand) {
			return BAND_LABELS[sBand] || "Nao analisado";
		},

		bandState: function (sBand) {
			return BAND_STATES[sBand] || "None";
		},

		passedText: function (bPassed) {
			return bPassed ? "Passou" : "Falhou";
		},

		passedState: function (bPassed) {
			return bPassed ? "Success" : "Error";
		}
	};
});
