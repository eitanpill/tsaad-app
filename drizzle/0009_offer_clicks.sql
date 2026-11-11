CREATE TABLE "offer_clicks" (
	"offer" text NOT NULL,
	"day" date NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "offer_clicks_offer_day_pk" PRIMARY KEY("offer","day"),
	CONSTRAINT "offer_clicks_offer" CHECK ("offer_clicks"."offer" in ('challenge','session','bundle','yesodot')),
	CONSTRAINT "offer_clicks_clicks" CHECK ("offer_clicks"."clicks" >= 0)
);
