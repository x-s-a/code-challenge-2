CREATE SEQUENCE "public"."threads_public_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."users_public_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "threads" ALTER COLUMN "public_id" SET DEFAULT 'T' || replace(format('%3s', nextval('threads_public_id_seq')), ' ', '0');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "public_id" SET DEFAULT 'U' || replace(format('%3s', nextval('users_public_id_seq')), ' ', '0');