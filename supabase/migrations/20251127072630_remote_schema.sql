create extension if not exists "pg_cron" with schema "pg_catalog";

revoke delete on table "public"."audit_logs" from "anon";

revoke insert on table "public"."audit_logs" from "anon";

revoke references on table "public"."audit_logs" from "anon";

revoke select on table "public"."audit_logs" from "anon";

revoke trigger on table "public"."audit_logs" from "anon";

revoke truncate on table "public"."audit_logs" from "anon";

revoke update on table "public"."audit_logs" from "anon";

revoke delete on table "public"."audit_logs" from "authenticated";

revoke insert on table "public"."audit_logs" from "authenticated";

revoke references on table "public"."audit_logs" from "authenticated";

revoke select on table "public"."audit_logs" from "authenticated";

revoke trigger on table "public"."audit_logs" from "authenticated";

revoke truncate on table "public"."audit_logs" from "authenticated";

revoke update on table "public"."audit_logs" from "authenticated";

revoke delete on table "public"."audit_logs" from "service_role";

revoke insert on table "public"."audit_logs" from "service_role";

revoke references on table "public"."audit_logs" from "service_role";

revoke select on table "public"."audit_logs" from "service_role";

revoke trigger on table "public"."audit_logs" from "service_role";

revoke truncate on table "public"."audit_logs" from "service_role";

revoke update on table "public"."audit_logs" from "service_role";

revoke delete on table "public"."rate_limits" from "anon";

revoke insert on table "public"."rate_limits" from "anon";

revoke references on table "public"."rate_limits" from "anon";

revoke select on table "public"."rate_limits" from "anon";

revoke trigger on table "public"."rate_limits" from "anon";

revoke truncate on table "public"."rate_limits" from "anon";

revoke update on table "public"."rate_limits" from "anon";

revoke delete on table "public"."rate_limits" from "authenticated";

revoke insert on table "public"."rate_limits" from "authenticated";

revoke references on table "public"."rate_limits" from "authenticated";

revoke select on table "public"."rate_limits" from "authenticated";

revoke trigger on table "public"."rate_limits" from "authenticated";

revoke truncate on table "public"."rate_limits" from "authenticated";

revoke update on table "public"."rate_limits" from "authenticated";

revoke delete on table "public"."rate_limits" from "service_role";

revoke insert on table "public"."rate_limits" from "service_role";

revoke references on table "public"."rate_limits" from "service_role";

revoke select on table "public"."rate_limits" from "service_role";

revoke trigger on table "public"."rate_limits" from "service_role";

revoke truncate on table "public"."rate_limits" from "service_role";

revoke update on table "public"."rate_limits" from "service_role";

alter table "public"."audit_logs" drop constraint "audit_logs_merchant_id_fkey";

alter table "public"."rate_limits" drop constraint "rate_limits_identifier_endpoint_key";

alter table "public"."audit_logs" drop constraint "audit_logs_pkey";

alter table "public"."rate_limits" drop constraint "rate_limits_pkey";

drop index if exists "public"."audit_logs_pkey";

drop index if exists "public"."idx_audit_logs_action";

drop index if exists "public"."idx_audit_logs_merchant_id";

drop index if exists "public"."idx_deposits_merchant_status_created";

drop index if exists "public"."idx_deposits_number";

drop index if exists "public"."idx_deposits_payment_id";

drop index if exists "public"."idx_merchants_dynamic_id";

drop index if exists "public"."idx_merchants_privy_id";

drop index if exists "public"."idx_merchants_status";

drop index if exists "public"."idx_orders_merchant_status_created";

drop index if exists "public"."idx_orders_number";

drop index if exists "public"."idx_orders_payment_id";

drop index if exists "public"."idx_orders_status_expired_at";

drop index if exists "public"."idx_rate_limits_identifier_endpoint";

drop index if exists "public"."idx_rate_limits_window_start";

drop index if exists "public"."rate_limits_identifier_endpoint_key";

drop index if exists "public"."rate_limits_pkey";

drop table "public"."audit_logs";

drop table "public"."rate_limits";

grant delete on table "public"."currencies" to "anon";

grant insert on table "public"."currencies" to "anon";

grant references on table "public"."currencies" to "anon";

grant select on table "public"."currencies" to "anon";

grant trigger on table "public"."currencies" to "anon";

grant truncate on table "public"."currencies" to "anon";

grant update on table "public"."currencies" to "anon";

grant delete on table "public"."currencies" to "authenticated";

grant insert on table "public"."currencies" to "authenticated";

grant references on table "public"."currencies" to "authenticated";

grant select on table "public"."currencies" to "authenticated";

grant trigger on table "public"."currencies" to "authenticated";

grant truncate on table "public"."currencies" to "authenticated";

grant update on table "public"."currencies" to "authenticated";

grant delete on table "public"."currencies" to "service_role";

grant insert on table "public"."currencies" to "service_role";

grant references on table "public"."currencies" to "service_role";

grant select on table "public"."currencies" to "service_role";

grant trigger on table "public"."currencies" to "service_role";

grant truncate on table "public"."currencies" to "service_role";

grant update on table "public"."currencies" to "service_role";

grant delete on table "public"."deposits" to "anon";

grant insert on table "public"."deposits" to "anon";

grant references on table "public"."deposits" to "anon";

grant select on table "public"."deposits" to "anon";

grant trigger on table "public"."deposits" to "anon";

grant truncate on table "public"."deposits" to "anon";

grant update on table "public"."deposits" to "anon";

grant delete on table "public"."deposits" to "authenticated";

grant insert on table "public"."deposits" to "authenticated";

grant references on table "public"."deposits" to "authenticated";

grant select on table "public"."deposits" to "authenticated";

grant trigger on table "public"."deposits" to "authenticated";

grant truncate on table "public"."deposits" to "authenticated";

grant update on table "public"."deposits" to "authenticated";

grant delete on table "public"."deposits" to "service_role";

grant insert on table "public"."deposits" to "service_role";

grant references on table "public"."deposits" to "service_role";

grant select on table "public"."deposits" to "service_role";

grant trigger on table "public"."deposits" to "service_role";

grant truncate on table "public"."deposits" to "service_role";

grant update on table "public"."deposits" to "service_role";

grant delete on table "public"."languages" to "anon";

grant insert on table "public"."languages" to "anon";

grant references on table "public"."languages" to "anon";

grant select on table "public"."languages" to "anon";

grant trigger on table "public"."languages" to "anon";

grant truncate on table "public"."languages" to "anon";

grant update on table "public"."languages" to "anon";

grant delete on table "public"."languages" to "authenticated";

grant insert on table "public"."languages" to "authenticated";

grant references on table "public"."languages" to "authenticated";

grant select on table "public"."languages" to "authenticated";

grant trigger on table "public"."languages" to "authenticated";

grant truncate on table "public"."languages" to "authenticated";

grant update on table "public"."languages" to "authenticated";

grant delete on table "public"."languages" to "service_role";

grant insert on table "public"."languages" to "service_role";

grant references on table "public"."languages" to "service_role";

grant select on table "public"."languages" to "service_role";

grant trigger on table "public"."languages" to "service_role";

grant truncate on table "public"."languages" to "service_role";

grant update on table "public"."languages" to "service_role";

grant delete on table "public"."merchants" to "anon";

grant insert on table "public"."merchants" to "anon";

grant references on table "public"."merchants" to "anon";

grant select on table "public"."merchants" to "anon";

grant trigger on table "public"."merchants" to "anon";

grant truncate on table "public"."merchants" to "anon";

grant update on table "public"."merchants" to "anon";

grant delete on table "public"."merchants" to "authenticated";

grant insert on table "public"."merchants" to "authenticated";

grant references on table "public"."merchants" to "authenticated";

grant select on table "public"."merchants" to "authenticated";

grant trigger on table "public"."merchants" to "authenticated";

grant truncate on table "public"."merchants" to "authenticated";

grant update on table "public"."merchants" to "authenticated";

grant delete on table "public"."merchants" to "service_role";

grant insert on table "public"."merchants" to "service_role";

grant references on table "public"."merchants" to "service_role";

grant select on table "public"."merchants" to "service_role";

grant trigger on table "public"."merchants" to "service_role";

grant truncate on table "public"."merchants" to "service_role";

grant update on table "public"."merchants" to "service_role";

grant delete on table "public"."orders" to "anon";

grant insert on table "public"."orders" to "anon";

grant references on table "public"."orders" to "anon";

grant select on table "public"."orders" to "anon";

grant trigger on table "public"."orders" to "anon";

grant truncate on table "public"."orders" to "anon";

grant update on table "public"."orders" to "anon";

grant delete on table "public"."orders" to "authenticated";

grant insert on table "public"."orders" to "authenticated";

grant references on table "public"."orders" to "authenticated";

grant select on table "public"."orders" to "authenticated";

grant trigger on table "public"."orders" to "authenticated";

grant truncate on table "public"."orders" to "authenticated";

grant update on table "public"."orders" to "authenticated";

grant delete on table "public"."orders" to "service_role";

grant insert on table "public"."orders" to "service_role";

grant references on table "public"."orders" to "service_role";

grant select on table "public"."orders" to "service_role";

grant trigger on table "public"."orders" to "service_role";

grant truncate on table "public"."orders" to "service_role";

grant update on table "public"."orders" to "service_role";

grant delete on table "public"."tokens" to "anon";

grant insert on table "public"."tokens" to "anon";

grant references on table "public"."tokens" to "anon";

grant select on table "public"."tokens" to "anon";

grant trigger on table "public"."tokens" to "anon";

grant truncate on table "public"."tokens" to "anon";

grant update on table "public"."tokens" to "anon";

grant delete on table "public"."tokens" to "authenticated";

grant insert on table "public"."tokens" to "authenticated";

grant references on table "public"."tokens" to "authenticated";

grant select on table "public"."tokens" to "authenticated";

grant trigger on table "public"."tokens" to "authenticated";

grant truncate on table "public"."tokens" to "authenticated";

grant update on table "public"."tokens" to "authenticated";

grant delete on table "public"."tokens" to "service_role";

grant insert on table "public"."tokens" to "service_role";

grant references on table "public"."tokens" to "service_role";

grant select on table "public"."tokens" to "service_role";

grant trigger on table "public"."tokens" to "service_role";

grant truncate on table "public"."tokens" to "service_role";

grant update on table "public"."tokens" to "service_role";


