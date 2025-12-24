type GameRequirements = {
	minimum: string;
	recommended: string;
};

type PackageGroup = {
	name: string;
	title: string;
	description: string;
	selection_text: string;
	save_text: string;
	display_type: number;
	is_recurring_subscription: string;
	subs: {
		packageid: number;
		percent_savings_text: string;
		percent_savings: number;
		option_text: string;
		option_description: string;
		can_get_free_license: string;
		is_free_license: boolean;
		price_in_cents_with_discount: number;
	}[];
};

type Category = {
	id: number;
	description: string;
};

type Genre = {
	id: string;
	description: string;
};

type Screenshot = {
	id: number;
	path_thumbnail: string;
	path_full: string;
};

type PlatformSupport = {
	windows: boolean;
	mac: boolean;
	linux: boolean;
};

type PriceOverview = {
	currency: string;
	initial: number;
	final: number;
	discount_percent: number;
	initial_formatted: string;
	final_formatted: string;
};

type Metacritic = {
	score: number;
	url: string;
};

export type GameData = {
	type: string;
	name: string;
	steam_appid: number;
	required_age: number;
	is_free: boolean;
	controller_support: string;
	dlc: number[];
	detailed_description: string;
	about_the_game: string;
	short_description: string;
	supported_languages: string;
	reviews: string;
	header_image: string;
	capsule_image: string;
	capsule_imagev5: string;
	website: string;
	pc_requirements: GameRequirements;
	mac_requirements: GameRequirements;
	linux_requirements: GameRequirements[];
	legal_notice: string;
	developers: string[];
	publishers: string[];
	price_overview: PriceOverview;
	packages: number[];
	package_groups: PackageGroup[];
	platforms: PlatformSupport;
	metacritic: Metacritic;
	categories: Category[];
	recommendations: {
		total: number;
	};
	genres: Genre[];
	screenshots: Screenshot[];
	release_date: {
		coming_soon: boolean;
		date: string;
	};
};

// Steam App Info API Types
export type SteamAppInfoResponse = {
	data: Record<string, SteamAppInfo>;
	status: string;
};

export type SteamAppInfo = {
	_change_number: number;
	_missing_token: boolean;
	_sha: string;
	_size: number;
	appid: string;
	common: SteamAppCommon;
	config: SteamAppConfig;
	depots: SteamDepots;
	extended: SteamAppExtended;
	ufs: SteamUFS;
};

export type SteamAppCommon = {
	associations?: Record<string, SteamAssociation>;
	category?: Record<string, string>;
	clienticns?: string;
	clienticon?: string;
	clienttga?: string;
	community_hub_visible?: string;
	community_visible_stats?: string;
	controller_support?: string;
	controllertagwizard?: string;
	eulas?: Record<string, SteamEULA>;
	exfgls?: string;
	gameid?: string;
	genres?: Record<string, string>;
	header_image?: Record<string, string>;
	icon?: string;
	languages?: Record<string, string>;
	library_assets?: SteamLibraryAssets;
	library_assets_full?: SteamLibraryAssetsFull;
	linuxclienticon?: string;
	logo?: string;
	logo_small?: string;
	market_presence?: string;
	metacritic_fullurl?: string;
	metacritic_name?: string;
	metacritic_score?: string;
	metacritic_url?: string;
	name: string;
	original_release_date?: string;
	osarch?: string;
	osextended?: string;
	oslist?: string;
	primary_genre?: string;
	releasestate?: string;
	review_percentage?: string;
	review_score?: string;
	small_capsule?: Record<string, string>;
	steam_deck_compatibility?: SteamDeckCompatibility;
	steam_release_date?: string;
	store_asset_mtime?: string;
	store_tags?: Record<string, string>;
	supported_languages?: Record<string, SteamSupportedLanguage>;
	type?: string;
	workshop_visible?: string;
	public_only?: '1' | '0';
};

export type SteamAssociation = {
	name: string;
	type: string;
};

export type SteamEULA = {
	id: string;
	name: string;
	url: string;
	version: string;
};

export type SteamLibraryAssets = {
	library_capsule?: string;
	library_header?: string;
	library_hero?: string;
	library_hero_blur?: string;
	library_logo?: string;
	logo_position?: SteamLogoPosition;
};

export type SteamLogoPosition = {
	height_pct: string;
	pinned_position: string;
	width_pct: string;
};

export type SteamLibraryAssetsFull = {
	library_capsule?: SteamImageSet;
	library_header?: SteamImageSet;
	library_hero?: SteamHeroImage;
	library_hero_blur?: SteamHeroImage;
	library_logo?: SteamLogoImageSet;
};

export type SteamImageSet = {
	image?: Record<string, string>;
	image2x?: Record<string, string>;
};

export type SteamHeroImage = {
	image?: Record<string, string>;
};

export type SteamLogoImageSet = {
	image?: Record<string, string>;
	image2x?: Record<string, string>;
	logo_position?: SteamLogoPosition;
};

export type SteamDeckCompatibility = {
	category?: string;
	configuration?: SteamDeckConfiguration;
	steamos_compatibility?: string;
	steamos_tests?: Record<string, SteamDeckTest>;
	test_timestamp?: string;
	tested_build_id?: string;
	tests?: Record<string, SteamDeckTest>;
};

export type SteamDeckConfiguration = {
	gamescope_frame_limiter_not_supported?: string;
	hdr_support?: string;
	non_deck_display_glyphs?: string;
	primary_player_is_controller_slot_0?: string;
	recommended_runtime?: string;
	requires_h264?: string;
	requires_internet_for_setup?: string;
	requires_internet_for_singleplayer?: string;
	requires_manual_keyboard_invoke?: string;
	requires_non_controller_launcher_nav?: string;
	requires_voice_files?: string;
	small_text?: string;
	supported_input?: string;
};

export type SteamDeckTest = {
	display: string;
	token: string;
};

export type SteamSupportedLanguage = {
	full_audio?: string;
	supported: string;
};

export type SteamAppConfig = {
	app_mappings?: Record<string, SteamAppMapping>;
	checkforupdatesbeforelaunch?: string;
	externalarguments?: SteamExternalArguments;
	installdir?: string;
	launch?: Record<string, SteamLaunchOption>;
	signedfiles?: Record<string, string>;
	steamcontrollerconfigdetails?: Record<string, SteamControllerConfig>;
	steamcontrollertemplateindex?: string;
	steamcontrollertouchconfigdetails?: Record<string, SteamTouchConfig>;
	steamcontrollertouchtemplateindex?: string;
	systemprofile?: string;
	uselaunchcommandline?: string;
	usemms?: string;
	verifyupdates?: string;
	vrcompositorsupport?: string;
};

export type SteamAppMapping = {
	comment?: string;
	platform?: string;
	priority?: string;
	tool?: string;
};

export type SteamExternalArguments = {
	allowunknown?: string;
};

export type SteamLaunchOption = {
	arguments?: string;
	config?: SteamLaunchConfig;
	description?: string;
	description_loc?: Record<string, string>;
	executable?: string;
	type?: string;
};

export type SteamLaunchConfig = {
	betakey?: string;
	osarch?: string;
	oslist?: string;
};

export type SteamControllerConfig = {
	controller_type?: string;
	enabled_branches?: string;
};

export type SteamTouchConfig = {
	controller_type?: string;
	enabled_branches?: string;
	use_action_block?: string;
};

export type SteamDepot = {
	config?: Record<string, string>;
	depotfromapp?: string;
	manifests?: Record<string, SteamManifest>;
	sharedinstall?: string;
	systemdefined?: string;
};

export type SteamManifest = {
	download: string;
	gid: string;
	size: string;
};

export type SteamBranch = {
	buildid?: string;
	description?: string;
	timeupdated?: string;
};

export type SteamDepots = {
	[key: string]: SteamDepot | string | Record<string, SteamBranch> | undefined;
	baselanguages?: string;
	branches?: Record<string, SteamBranch>;
	hasdepotsindlc?: string;
	overridescddb?: string;
	privatebranches?: string;
	workshopdepot?: string;
};

export type SteamAppExtended = {
	aliases?: string;
	deckresolutionoverride?: string;
	developer?: string;
	developer_url?: string;
	gamedir?: string;
	gamemanualurl?: string;
	homepage?: string;
	icon?: string;
	icon2?: string;
	isfreeapp?: string;
	languages?: string;
	listofdlc?: string;
	loadallbeforelaunch?: string;
	minclientversion?: string;
	noservers?: string;
	primarycache?: string;
	primarycache_linux?: string;
	publisher?: string;
	requiressse?: string;
	serverbrowsername?: string;
	sourcegame?: string;
	state?: string;
	vacmacmodulecache?: string;
	vacmodulecache?: string;
	vacmodulefilename?: string;
	validoslist?: string;
};

export type SteamUFS = {
	hidecloudui?: string;
	maxnumfiles?: string;
	quota?: string;
};