-- 還原 line_links.sql。會刪掉已綁定的 LINE 名稱（後台就看不到誰的 LINE 是什麼了）。
-- 先備份：SELECT * FROM public.line_links;
DROP FUNCTION IF EXISTS public.get_member_line_names();
DROP TABLE IF EXISTS public.line_links;
DROP TABLE IF EXISTS public.line_link_codes;
