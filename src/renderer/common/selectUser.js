import { Dropdown, Image, Option } from '@fluentui/react-components';
import { useAuthUser } from '../contexts/allUsersContext';


export default function SelectUserDropdown({
  user,
  setUser,
  disabled,
  placeholder,
  filter,
}) {
  const { allUsers } = useAuthUser();
  if (!allUsers) {
    return <div>Error loading all users</div>;
  }
  return (
    <Dropdown
      disabled={disabled}
      size="large"
      placeholder={placeholder || 'Select a User'}
      style={{ width: '50%' }}
      value={user?.username || ''}
      onOptionSelect={(ev, data) => {
        setUser(data.optionValue);
      }}
    >
      {allUsers
        .filter((x) => !x.isDeactivated)
        .filter((x) => (filter ? filter(x) : true))
        .map((option) => (
          <Option value={option} key={option.id}>
            <Image
              src={
                option.profilePicture ||
                'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-538.jpg'
              }
              style={{ width: '30px', marginRight: '10px' }}
              shape="circular"
            />

            {option.username}
          </Option>
        ))}
    </Dropdown>
  );
}
