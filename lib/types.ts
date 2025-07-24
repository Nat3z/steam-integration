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