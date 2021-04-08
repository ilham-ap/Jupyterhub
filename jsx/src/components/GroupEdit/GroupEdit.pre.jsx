import React, { useState } from "react";
import { Link } from "react-router-dom";
import Multiselect from "../Multiselect/Multiselect";
import PropTypes from "prop-types";

const GroupEdit = (props) => {
  var [selected, setSelected] = useState([]),
    [changed, setChanged] = useState(false),
    [added, setAdded] = useState(undefined),
    [removed, setRemoved] = useState(undefined);

  var {
    addToGroup,
    removeFromGroup,
    deleteGroup,
    refreshGroupsData,
    history,
    location,
  } = props;

  if (!location.state) {
    history.push("/groups");
    return <></>;
  }

  var { group_data, user_data, callback } = location.state;

  if (!(group_data && user_data)) return <div></div>;

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-10 col-md-offset-1 col-lg-8 col-lg-offset-2">
          <h3>Editing Group {group_data.name}</h3>
          <br></br>
          <div className="alert alert-info">Select group members</div>
          <Multiselect
            options={user_data.map((e) => e.name)}
            value={group_data.users}
            onChange={(selection, options) => {
              setSelected(selection);
              setChanged(true);
            }}
          />
          <br></br>
          <button id="return" className="btn btn-light">
            <Link to="/groups">Back</Link>
          </button>
          <span> </span>
          <button
            id="submit"
            className="btn btn-primary"
            onClick={() => {
              // check for changes
              if (!changed) {
                history.push("/groups");
                return;
              }

              let new_users = selected.filter(
                (e) => !group_data.users.includes(e)
              );
              let removed_users = group_data.users.filter(
                (e) => !selected.includes(e)
              );

              setAdded(new_users);
              setRemoved(removed_users);

              let promiseQueue = [];
              if (new_users.length > 0)
                promiseQueue.push(addToGroup(new_users, group_data.name));
              if (removed_users.length > 0)
                promiseQueue.push(
                  removeFromGroup(removed_users, group_data.name)
                );

              Promise.all(promiseQueue)
                .then((e) => callback())
                .catch((err) => console.log(err));

              history.push("/groups");
            }}
          >
            Apply
          </button>
          <button
            id="delete-group"
            className="btn btn-danger"
            style={{ float: "right" }}
            onClick={() => {
              var groupName = group_data.name;
              deleteGroup(groupName)
                .then(refreshGroupsData())
                .then(history.push("/groups"))
                .catch((err) => console.log(err));
            }}
          >
            Delete Group
          </button>
          <br></br>
          <br></br>
        </div>
      </div>
    </div>
  );
};

GroupEdit.propTypes = {
  location: PropTypes.shape({
    state: PropTypes.shape({
      group_data: PropTypes.object,
      user_data: PropTypes.array,
      callback: PropTypes.func,
    }),
  }),
  history: PropTypes.shape({
    push: PropTypes.func,
  }),
  addToGroup: PropTypes.func,
  removeFromGroup: PropTypes.func,
  deleteGroup: PropTypes.func,
  refreshGroupsData: PropTypes.func,
};

export default GroupEdit;