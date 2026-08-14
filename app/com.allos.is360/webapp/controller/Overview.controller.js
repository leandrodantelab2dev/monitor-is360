sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast"
], function (BaseController, JSONModel, Filter, FilterOperator, MessageToast) {
	"use strict";

	const SEVERITY_COLOR = { alta: "Error", media: "Critical", baixa: "Neutral" };

	function scoreColor(fScore) {
		if (fScore >= 80) return "Good";
		if (fScore >= 50) return "Critical";
		return "Error";
	}

	return BaseController.extend("com.allos.is360.controller.Overview", {

		onInit: function () {
			this.setModel(new JSONModel({
				total: 0, avgScore: "0.0", avgScoreColor: "Neutral",
				verde: 0, amarelo: 0, vermelho: 0, analisados: 1,
				topRules: [], lastSyncText: ""
			}), "stats");
			this.getRouter().getRoute("overview").attachPatternMatched(this._loadStats, this);
		},

		onViewIflows: function () {
			this.navTo("iflows");
		},

		onSync: function () {
			this._callAction("/syncInventory(...)", {}, (oResult, oBundle) => {
				MessageToast.show(oBundle.getText("msgSyncSuccess", [oResult.packages, oResult.iflows]));
			});
		},

		onAnalyzeAll: function () {
			this._callAction("/analyzeAll(...)", {}, (oResult, oBundle) => {
				MessageToast.show(oBundle.getText("msgAnalyzeAllSuccess", [oResult.analisados, oResult.falhas]));
			});
		},

		_callAction: function (sPath, mParameters, fnOnSuccess) {
			this.getView().setBusy(true);
			const oOperation = this.getModel().bindContext(sPath, undefined, { $$updateGroupId: "$auto" });
			Object.keys(mParameters).forEach(sKey => oOperation.setParameter(sKey, mParameters[sKey]));
			oOperation.execute()
				.then(() => Promise.all([oOperation.getBoundContext().getObject(), this.getResourceBundle()]))
				.then(([oResult, oBundle]) => {
					this.getView().setBusy(false);
					fnOnSuccess(oResult, oBundle);
					this._loadStats();
				})
				.catch(oError => Promise.all([oError, this.getResourceBundle()]).then(([oErr, oBundle]) => {
					this.getView().setBusy(false);
					MessageToast.show(oBundle.getText("msgError", [oErr.message]));
				}));
		},

		_loadStats: function () {
			const oIflowsBinding = this.getModel().bindList("/Iflows");
			const oFailedBinding = this.getModel().bindList("/RuleResults", undefined, undefined, [new Filter("passed", FilterOperator.EQ, false)]);

			Promise.all([
				oIflowsBinding.requestContexts(0, 1000),
				oFailedBinding.requestContexts(0, 5000),
				this.getResourceBundle()
			]).then(([aIflowContexts, aFailedContexts, oBundle]) => {
				const aIflows = aIflowContexts.map(oContext => oContext.getObject());
				const aAnalyzed = aIflows.filter(oIflow => oIflow.band);
				const oCounts = { verde: 0, amarelo: 0, vermelho: 0 };
				aAnalyzed.forEach(oIflow => { if (oCounts[oIflow.band] !== undefined) oCounts[oIflow.band]++; });

				const fAvg = aAnalyzed.length
					? aAnalyzed.reduce((fSum, oIflow) => fSum + (parseFloat(oIflow.score) || 0), 0) / aAnalyzed.length
					: 0;

				const oLastSync = aIflows.reduce((sMax, oIflow) => (oIflow.syncedAt > sMax ? oIflow.syncedAt : sMax), "");

				const oByRule = {};
				aFailedContexts.map(oContext => oContext.getObject()).forEach(oRule => {
					if (!oByRule[oRule.ruleId]) oByRule[oRule.ruleId] = { ruleId: oRule.ruleId, severidade: oRule.severidade, count: 0 };
					oByRule[oRule.ruleId].count++;
				});
				const aTopRules = Object.values(oByRule)
					.sort((a, b) => b.count - a.count)
					.slice(0, 5)
					.map(oRule => ({ ...oRule, displayValue: String(oRule.count), color: SEVERITY_COLOR[oRule.severidade] || "Neutral" }));

				this.getModel("stats").setData({
					total: aIflows.length,
					avgScore: fAvg.toFixed(1),
					avgScoreColor: aAnalyzed.length ? scoreColor(fAvg) : "Neutral",
					analisados: aAnalyzed.length || 1,
					topRules: aTopRules,
					lastSyncText: oLastSync ? oBundle.getText("lastSyncLabel", [new Date(oLastSync).toLocaleString()]) : oBundle.getText("neverSynced"),
					...oCounts
				});
			});
		}
	});
});
