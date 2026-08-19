sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast"
], function (BaseController, JSONModel, MessageToast) {
	"use strict";

	const SEVERITY_RANK = { alta: 0, media: 1, baixa: 2 };

	return BaseController.extend("com.allos.is360.controller.IflowDetail", {

		onInit: function () {
			this.setModel(new JSONModel({ total: 0, passed: 0, failed: 0 }), "summary");
			this.setModel(new JSONModel({ failed: [], passed: [], passedCount: 0, passedCollapsedLabel: "", showOnlyFailed: false }), "rules");
			this.getRouter().getRoute("iflowDetail").attachPatternMatched(this._onRouteMatched, this);
		},

		onToggleShowOnlyFailed: function (oEvent) {
			this.getModel("rules").setProperty("/showOnlyFailed", oEvent.getParameter("state"));
		},

		_onRouteMatched: function (oEvent) {
			this._sIflowId = oEvent.getParameter("arguments").iflowId;
			this._bindIflow();
			this._loadSummary();
			this._loadRules();
		},

		_bindIflow: function () {
			this.getView().bindElement({
				path: "/Iflows('" + this._sIflowId.replace(/'/g, "''") + "')",
				parameters: { $expand: "results" }
			});
		},

		_loadSummary: function () {
			const oBinding = this.getModel().bindList(`/Iflows('${this._sIflowId.replace(/'/g, "''")}')/results`);
			oBinding.requestContexts(0, 500).then(aContexts => {
				const aResults = aContexts.map(oContext => oContext.getObject());
				const iPassed = aResults.filter(oResult => oResult.passed).length;
				this.getModel("summary").setData({ total: aResults.length, passed: iPassed, failed: aResults.length - iPassed });
			});
		},

		_loadRules: function () {
			const oBinding = this.getModel().bindList(`/Iflows('${this._sIflowId.replace(/'/g, "''")}')/results`);
			oBinding.requestContexts(0, 500).then(aContexts => {
				const aResults = aContexts.map(oContext => oContext.getObject());
				const aFailed = aResults
					.filter(oResult => !oResult.passed)
					.sort((a, b) => (SEVERITY_RANK[a.severidade] ?? 9) - (SEVERITY_RANK[b.severidade] ?? 9));
				const aPassed = aResults.filter(oResult => oResult.passed);

				this.getResourceBundle().then(oBundle => {
					this.getModel("rules").setData({
						failed: aFailed,
						passed: aPassed,
						passedCount: aPassed.length,
						passedCollapsedLabel: oBundle.getText("passedRulesCollapsedLabel", [aPassed.length]),
						showOnlyFailed: this.getModel("rules").getProperty("/showOnlyFailed")
					});
				});
			});
		},

		onAnalyze: function () {
			this.getView().setBusy(true);
			const oOperation = this.getModel().bindContext("/analyzeIflow(...)");
			oOperation.setParameter("ID", this._sIflowId);
			oOperation.execute()
				.then(() => this.getResourceBundle())
				.then(oBundle => {
					this.getView().setBusy(false);
					MessageToast.show(oBundle.getText("msgAnalyzeOneSuccess"));
					this._bindIflow();
					this._loadSummary();
					this._loadRules();
				})
				.catch(oError => Promise.all([oError, this.getResourceBundle()]).then(([oErr, oBundle]) => {
					this.getView().setBusy(false);
					MessageToast.show(oBundle.getText("msgError", [oErr.message]));
				}));
		}
	});
});
