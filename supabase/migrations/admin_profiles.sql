-- 後台管理帳號權限分級
-- role: 'admin'（管理組）| 'staff'（行政組）| 'finance'（財務組）

CREATE TABLE admin_profiles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role       text NOT NULL CHECK (role IN ('admin', 'staff', 'finance')) DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

-- 本人可讀自己的 role
CREATE POLICY "admin_profiles_read_own"
  ON admin_profiles FOR SELECT
  USING (auth.uid() = user_id);
