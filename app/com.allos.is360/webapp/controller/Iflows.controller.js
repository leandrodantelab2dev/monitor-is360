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
			this.setModel(new JSONModel({
				packages: [], scoreRange: [0, 100],
				packageChipText: "", scoreChipText: ""
			}), "filters");
			this._sBand = "all";
			this._sQuery = "";
			this._sPackage = "";
			this._aScoreRange = [0, 100];
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

		onPackageFilterChange: function (oEvent) {
			this._sPackage = oEvent.getParameter("selectedItem").getKey();
			this.getModel("filters").setProperty("/selectedPackage", this._sPackage);
			this._updateChips();
			this._applyFilters();
		},

		onScoreRangeChange: function (oEvent) {
			this._aScoreRange = oEvent.getParameter("range");
			this._updateChips();
			this._applyFilters();
		},

		onClearPackageFilter: function () {
			this._sPackage = "";
			this.getModel("filters").setProperty("/selectedPackage", "");
			this._updateChips();
			this._applyFilters();
		},

		onClearScoreFilter: function () {
			this._aScoreRange = [0, 100];
			this.getModel("filters").setProperty("/scoreRange", [0, 100]);
			this._updateChips();
			this._applyFilters();
		},

		onClearFilters: function () {
			this._sPackage = "";
			this._aScoreRange = [0, 100];
			const oFiltersModel = this.getModel("filters");
			oFiltersModel.setProperty("/selectedPackage", "");
			oFiltersModel.setProperty("/scoreRange", [0, 100]);
			this._updateChips();
			this._applyFilters();
		},

		_updateChips: function () {
			this.getResourceBundle().then(oBundle => {
				const oFiltersModel = this.getModel("filters");
				oFiltersModel.setProperty("/packageChipText", this._sPackage ? oBundle.getText("chipPackage", [this._sPackage]) : "");
				const [iMin, iMax] = this._aScoreRange;
				oFiltersModel.setProperty("/scoreChipText", (iMin > 0 || iMax < 100) ? oBundle.getText("chipScore", [iMin, iMax]) : "");
			});
		},

		_applyFilters: function () {
			const aFilters = [];
			if (this._sBand !== "all") aFilters.push(new Filter("band", FilterOperator.EQ, this._sBand));
			if (this._sQuery) aFilters.push(new Filter("name", FilterOperator.Contains, this._sQuery));
			if (this._sPackage) aFilters.push(new Filter("package/name", FilterOperator.EQ, this._sPackage));
			const [iMin, iMax] = this._aScoreRange;
			if (iMin > 0 || iMax < 100) aFilters.push(new Filter("score", FilterOperator.BT, iMin, iMax));
			this.byId("iflowsTable").getBinding("items").filter(aFilters);
		},

		_loadCounts: function () {
			const oBinding = this.getModel().bindList("/Iflows", undefined, undefined, undefined, {
				$select: "ID,band",
				$expand: "package($select=name)"
			});
			Promise.all([oBinding.requestContexts(0, 1000), this.getResourceBundle()]).then(([aContexts, oBundle]) => {
				const aData = aContexts.map(oContext => oContext.getObject());
				const oCounts = { all: aData.length, verde: 0, amarelo: 0, vermelho: 0 };
				aData.forEach(oIflow => { if (oCounts[oIflow.band] !== undefined) oCounts[oIflow.band]++; });
				this.getModel("counts").setData(oCounts);

				const aPackageNames = [...new Set(aData.map(oIflow => oIflow.package && oIflow.package.name).filter(Boolean))].sort();
				const aPackages = [{ key: "", text: oBundle.getText("filterAllPackages") }]
					.concat(aPackageNames.map(sName => ({ key: sName, text: sName })));
				this.getModel("filters").setProperty("/packages", aPackages);
			});
		}
	});
});
