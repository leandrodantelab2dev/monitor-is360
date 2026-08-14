sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter"
], function (BaseController, JSONModel, Filter, FilterOperator, Sorter) {
	"use strict";

	return BaseController.extend("com.allos.is360.controller.Iflows", {

		onInit: function () {
			this.setModel(new JSONModel({ all: 0, verde: 0, amarelo: 0, vermelho: 0 }), "counts");
			this._sBand = "all";
			this._sQuery = "";
			this._bSortDesc = true;
			this.getRouter().getRoute("iflows").attachPatternMatched(this._loadCounts, this);
		},

		onOpenIflow: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext();
			this.navTo("iflowDetail", { iflowId: oContext.getProperty("ID") });
		},

		onRefresh: function () {
			this.byId("iflowsTable").getBinding("items").refresh();
			this._loadCounts();
		},

		onSearch: function (oEvent) {
			this._sQuery = oEvent.getParameter("newValue") || "";
			this._applyFilters();
		},

		onTabSelect: function (oEvent) {
			this._sBand = oEvent.getParameter("key");
			this._applyFilters();
		},

		onToggleSort: function () {
			this._bSortDesc = !this._bSortDesc;
			this.byId("iflowsTable").getBinding("items").sort(new Sorter("score", this._bSortDesc));
		},

		_applyFilters: function () {
			const aFilters = [];
			if (this._sBand !== "all") aFilters.push(new Filter("band", FilterOperator.EQ, this._sBand));
			if (this._sQuery) aFilters.push(new Filter("name", FilterOperator.Contains, this._sQuery));
			this.byId("iflowsTable").getBinding("items").filter(aFilters);
		},

		_loadCounts: function () {
			const oBinding = this.getModel().bindList("/Iflows");
			oBinding.requestContexts(0, 1000).then(aContexts => {
				const aData = aContexts.map(oContext => oContext.getObject());
				const oCounts = { all: aData.length, verde: 0, amarelo: 0, vermelho: 0 };
				aData.forEach(oIflow => { if (oCounts[oIflow.band] !== undefined) oCounts[oIflow.band]++; });
				this.getModel("counts").setData(oCounts);
			});
		}
	});
});
