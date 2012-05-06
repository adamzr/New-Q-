String.prototype.startsWith = function(str){ return (this.match("^"+str)==str);}

function Profile(tags, anyTags, site, ignoredTags) {
    var self = this;
    self.tags = ko.observable(tags);
    self.anyTags = ko.observable(anyTags);
	self.site = ko.observable(site);
	self.ignoredTags = ko.observable(ignoredTags)
}

function ProfilesViewModel() {
    var self = this;

	self.token = ko.observable("");

    self.sites = ko.observableArray([]);

    self.badgeSite = ko.observable("");

    self.autoclose = ko.observable(true);

    // Editable data
    self.profiles = ko.observableArray([
        //new Profile("c# java php", true, {name: "StackOverflow"},"class-manipulation")
    ]);
}

var viewModel;// = new ProfilesViewModel();
var bgPage = chrome.extension.getBackgroundPage();
var API_VERSION = bgPage.apiVersion();
var API_KEY = bgPage.apiKey();
var API_URL = bgPage.apiURL();
var SITES_FILTER = "!)5BWLlrU39t_oe09Sg)Xf.o*-r-(";

// Saves options to localStorage.
function saveOptions() {
	localStorage.viewModel = ko.toJSON(viewModel);
	bgPage.loadData();
  	
	// Update status to let user know options were saved.
  	var $status = $("#status");
  	$status.text("Options Saved.");
  	setTimeout(function() {
    	$status.text("");
  	}, 750);
}

// Restores select box state to saved value from localStorage.
function restoreOptions() {
	var json = "";
  	if(localStorage.viewModel){
		json = localStorage.viewModel;
	}
	else{
		json='{"token":"","badgeSite":"", "autoclose": true, "sites":[{"name":"Stack Overflow","logo_url":"http://sstatic.net/stackoverflow/img/logo.png","api_site_parameter":"stackoverflow","site_url":"http://stackoverflow.com","icon_url":"http://sstatic.net/stackoverflow/img/apple-touch-icon.png","favicon_url":"http://sstatic.net/stackoverflow/img/favicon.ico"}],"profiles":[]}'
	}
	
	viewModel = ko.mapping.fromJSON(json);
	
	// Upgrade code
	if(!viewModel.autoclose){
		viewModel.autoclose = ko.observable(true);		
	}
	if(!viewModel.badgeSite){
		viewModel.badgeSite = ko.observable("");
	}
	
	viewModel.addProfile = function(){
		viewModel.profiles.push(new Profile("",true,this.sites()[0],""));
	}
	
	viewModel.removeProfile = function(profile) {
	    viewModel.profiles.remove(profile);
	}
	
	viewModel.isAuthorized =  ko.computed(function(){
	    return this.token && this.token().length > 0;
	}, viewModel);
	
	viewModel.isNotAuthorized =  ko.computed(function(){
	    return !this.token || this.token().length === 0;
	}, viewModel);
}

$(document).ready(function(){
	restoreOptions();
	
     $.getJSON(API_URL + "/" + API_VERSION + "/sites", {"key" : API_KEY, "filter" : SITES_FILTER, "pagesize" : 200 }, function(data){
		 viewModel.sites = ko.observableArray(data.items);
		 ko.applyBindings(viewModel);
     });
    
    function favTags(){
        var chosenSite = JSON.parse($("#site").val());
        var favTags = []
        $.getJSON(chosenSite.api_endpoint + "/" + API_VERSION + "/users/" + $("#userID").val() + "/tags", {"pagesize" : "5", "key" : API_KEY}, function(data){
            $.each(data.tags, function(i, item){
                favTags.push(item.name);
            });
            $("#favtags").empty();
            $("#favtags").click(function(){$("#tags").val(favTags.join(' '))});
            if(favTags.length) $("#favtags").text("Your most commonly used tags (click to use them): " + favTags.join(", "));
        })
    }
	
	$("#authorize").click(function(){
		var currentTabID = "0";
		chrome.tabs.getCurrent(function(tab){currentTabID = tab.id;});
		chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
		  	if(changeInfo.url && changeInfo.url.startsWith("https://stackexchange.com/oauth/login_success")){
				viewModel.token(changeInfo.url.split("=")[1]);
				console.log(viewModel.token());
				$.ajaxSetup({data: {'access_token': viewModel.token()}});
				saveOptions();
				bgPage.authorizeAllAjaxCalls(viewModel.token());
				chrome.tabs.remove(tabId);
				chrome.tabs.update(currentTabID, {"active" : true});
			}
		});
		chrome.tabs.create({url: "https://stackexchange.com/oauth/dialog?client_id=110&redirect_uri=https://stackexchange.com/oauth/login_success&scope=read_inbox,no_expiry"});
	});
	
	$("#deauthorize").click(function(){
		var oldToken = viewModel.token();
		viewModel.token("");
		$.ajaxSetup({data: {}});
		saveOptions();
		bgPage.authorizeAllAjaxCalls();
		$.get(API_URL + "/" + API_VERSION + "/access-tokens/" + oldToken + "/invalidate");
	});
	
	if(viewModel.token()){
		$("#notconnected").hide();
	}
	else{
		$("#connected").hide();
	}
});