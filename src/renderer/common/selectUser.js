import { Combobox, Image, Option } from '@fluentui/react-components';
import { useMemo, useState } from 'react';
import { useAuthUser } from '../contexts/allUsersContext';

const DEFAULT_AVATAR =
  'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-538.jpg';

function matchesUsername(username, query) {
  if (!query) return true;
  return (username || '').toLowerCase().startsWith(query.toLowerCase());
}

function matchesText(text, query) {
  if (!query) return true;
  return (text || '').toLowerCase().startsWith(query.toLowerCase());
}

export default function SelectUserDropdown({
  user,
  setUser,
  disabled,
  placeholder,
  filter,
  size = 'large',
  style,
  className,
  valueKey = 'object',
  includeAllOption = false,
  allOptionLabel = 'All',
  extraOptions = [],
  showProfilePicture = true,
  users: usersOverride,
  filterDeactivated = true,
  getDisplayName = (u) => u.username || u.email || u.uid || '',
  getOptionLabel,
}) {
  const { allUsers } = useAuthUser();
  const [query, setQuery] = useState('');
  const users = usersOverride || allUsers;
  const renderLabel = getOptionLabel || getDisplayName;

  const baseUsers = useMemo(() => {
    let list = users || [];
    if (filterDeactivated) {
      list = list.filter((x) => !x.isDeactivated);
    }
    if (filter) {
      list = list.filter((x) => filter(x));
    }
    return [...list].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b)),
    );
  }, [users, filterDeactivated, filter, getDisplayName]);

  const normalizedQuery = query.trim();

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return baseUsers;
    return baseUsers.filter((u) => matchesUsername(u.username, normalizedQuery));
  }, [baseUsers, normalizedQuery]);

  const filteredExtraOptions = useMemo(() => {
    if (!normalizedQuery) return extraOptions;
    return extraOptions.filter((opt) => matchesText(opt.text, normalizedQuery));
  }, [extraOptions, normalizedQuery]);

  const selectedDisplayName = useMemo(() => {
    if (includeAllOption && (user === null || user === undefined || user === '')) {
      return '';
    }
    if (valueKey === 'object') {
      return user ? getDisplayName(user) : '';
    }
    const extra = extraOptions.find((opt) => opt.value === user);
    if (extra) return extra.text;
    if (user === 'Accounts') return 'Accounts';
    const selected = baseUsers.find((u) => {
      if (valueKey === 'uid') return u.uid === user;
      if (valueKey === 'id') return u.id === user;
      return false;
    });
    return selected ? getDisplayName(selected) : user || '';
  }, [user, valueKey, baseUsers, extraOptions, includeAllOption, getDisplayName]);

  if (!users) {
    return <div>Error loading all users</div>;
  }

  const hasOptions =
    filteredUsers.length > 0 ||
    filteredExtraOptions.length > 0 ||
    (includeAllOption && !normalizedQuery);

  return (
    <Combobox
      disabled={disabled}
      size={size}
      placeholder={placeholder || 'Search username...'}
      style={{ width: '50%', ...style }}
      className={className}
      freeform
      value={query || selectedDisplayName}
      onChange={(e) => setQuery(e.target.value)}
      onOptionSelect={(_, data) => {
        setUser(data.optionValue);
        setQuery('');
      }}
      onOpenChange={(_, data) => {
        if (!data.open) setQuery('');
      }}
      listbox={{ style: { maxHeight: '240px', overflowY: 'auto' } }}
    >
      {includeAllOption && !normalizedQuery ? (
        <Option text={allOptionLabel} value={null} key="user-select-all">
          {allOptionLabel}
        </Option>
      ) : null}
      {filteredExtraOptions.map((opt) => (
        <Option text={opt.text} value={opt.value} key={opt.key || opt.text}>
          {opt.text}
        </Option>
      ))}
      {filteredUsers.map((option) => {
        const optionValue =
          valueKey === 'uid'
            ? option.uid
            : valueKey === 'id'
              ? option.id
              : option;
        return (
          <Option
            value={optionValue}
            text={renderLabel(option)}
            key={option.id || option.uid}
          >
            {showProfilePicture ? (
              <Image
                src={option.profilePicture || DEFAULT_AVATAR}
                style={{ width: '30px', marginRight: '10px' }}
                shape="circular"
              />
            ) : null}
            {renderLabel(option)}
          </Option>
        );
      })}
      {!hasOptions ? (
        <Option disabled value="" text="No users found" key="user-select-none">
          No users found
        </Option>
      ) : null}
    </Combobox>
  );
}
