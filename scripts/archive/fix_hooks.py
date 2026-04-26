with open('src/components/LiveStreamPlayer.tsx', 'r') as f:
    content = f.read()

# I placed the super admin check too low, inside the `if (hasAccess)` logic or after an early return
# Let's find where I placed it:
#   // ── Super Admin Check ────────────────────────────────────────────────────
#   const [isSuperAdminView, setIsSuperAdminView] = useState(false);

# Let's move it up to the other hooks at the top of LiveStreamPlayer
hook_code = """
  // ── Super Admin Check ────────────────────────────────────────────────────
  const [isSuperAdminView, setIsSuperAdminView] = useState(false);
  useEffect(() => {
    const isLocalSuperAdmin = localStorage.getItem('role') === 'superadmin';
    const isUrlAdmin = window.location.search.includes('admin=true');
    if (isLocalSuperAdmin || isUrlAdmin || isSuperAdmin) {
      setIsSuperAdminView(true);
    }
  }, [isSuperAdmin]);
"""

# remove it from current location
content = content.replace(hook_code, "")

# add it near the top of LiveStreamPlayer function, e.g., after
#   const [inviteInput, setInviteInput] = useState('');
#   const [redeemingInvite, setRedeemingInvite] = useState(false);
#
#   // ── Role classification ──────────────────────────────────────────────────
#   const isPlayer    = roles.includes('player');
#   const isPaidFan   = roles.includes('paid_fan');
#   const isSuperAdmin = roles.includes('super_admin');

target = "  const isSuperAdmin = roles.includes('super_admin');"

new_hook_code = """
  // ── Super Admin Check ────────────────────────────────────────────────────
  const [isSuperAdminView, setIsSuperAdminView] = useState(false);
  useEffect(() => {
    const isLocalSuperAdmin = localStorage.getItem('role') === 'superadmin';
    const isUrlAdmin = window.location.search.includes('admin=true');
    if (isLocalSuperAdmin || isUrlAdmin || isSuperAdmin) {
      setIsSuperAdminView(true);
    }
  }, [isSuperAdmin]);
"""

content = content.replace(target, target + "\n" + new_hook_code)

with open('src/components/LiveStreamPlayer.tsx', 'w') as f:
    f.write(content)
