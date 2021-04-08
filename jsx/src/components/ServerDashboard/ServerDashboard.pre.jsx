import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import "./server-dashboard.css";
import { timeSince } from "../../util/timeSince";
import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import PropTypes from "prop-types";

const ServerDashboard = (props) => {
  // sort methods
  var usernameDesc = (e) => e.sort((a, b) => (a.name > b.name ? 1 : -1)),
    usernameAsc = (e) => e.sort((a, b) => (a.name < b.name ? 1 : -1)),
    adminDesc = (e) => e.sort((a) => (a.admin ? -1 : 1)),
    adminAsc = (e) => e.sort((a) => (a.admin ? 1 : -1)),
    dateDesc = (e) =>
      e.sort((a, b) =>
        new Date(a.last_activity) - new Date(b.last_activity) > 0 ? -1 : 1
      ),
    dateAsc = (e) =>
      e.sort((a, b) =>
        new Date(a.last_activity) - new Date(b.last_activity) > 0 ? 1 : -1
      ),
    runningAsc = (e) => e.sort((a) => (a.server == null ? -1 : 1)),
    runningDesc = (e) => e.sort((a) => (a.server == null ? 1 : -1));

  var [addUser, setAddUser] = useState(false),
    [sortMethod, setSortMethod] = useState(null);

  var {
    user_data,
    updateUsers,
    shutdownHub,
    startServer,
    stopServer,
    startAll,
    stopAll,
    history,
    dispatch,
  } = props;

  var dispatchUserUpdate = (data) => {
    dispatch({
      type: "USER_DATA",
      value: data,
    });
  };

  if (!user_data) return <div></div>;

  if (sortMethod != null) {
    user_data = sortMethod(user_data);
  }

  return (
    <div className="container">
      <div className="manage-groups" style={{ float: "right", margin: "20px" }}>
        <Link to="/groups">{"> Manage Groups"}</Link>
      </div>
      <div className="server-dashboard-container">
        <table className="table table-striped table-bordered table-hover">
          <thead className="admin-table-head">
            <tr>
              <th id="user-header">
                User{" "}
                <SortHandler
                  sorts={{ asc: usernameAsc, desc: usernameDesc }}
                  callback={(method) => setSortMethod(() => method)}
                />
              </th>
              <th id="admin-header">
                Admin{" "}
                <SortHandler
                  sorts={{ asc: adminAsc, desc: adminDesc }}
                  callback={(method) => setSortMethod(() => method)}
                />
              </th>
              <th id="last-activity-header">
                Last Activity{" "}
                <SortHandler
                  sorts={{ asc: dateAsc, desc: dateDesc }}
                  callback={(method) => setSortMethod(() => method)}
                />
              </th>
              <th id="running-status-header">
                Running{" "}
                <SortHandler
                  sorts={{ asc: runningAsc, desc: runningDesc }}
                  callback={(method) => setSortMethod(() => method)}
                />
              </th>
              <th id="actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="noborder">
              <td>
                <Button variant="light" className="add-users-button">
                  <Link to="/add-users">Add Users</Link>
                </Button>
              </td>
              <td></td>
              <td></td>
              <td>
                {/* Start all servers */}
                <Button
                  variant="primary"
                  className="start-all"
                  onClick={() => {
                    Promise.all(startAll(user_data.map((e) => e.name)))
                      .then((res) => {
                        updateUsers()
                          .then((data) => data.json())
                          .then((data) => {
                            dispatchUserUpdate(data);
                          })
                          .catch((err) => console.log(err));
                        return res;
                      })
                      .catch((err) => console.log(err));
                  }}
                >
                  Start All
                </Button>
                <span> </span>
                {/* Stop all servers */}
                <Button
                  variant="danger"
                  className="stop-all"
                  onClick={() => {
                    Promise.all(stopAll(user_data.map((e) => e.name)))
                      .then((res) => {
                        updateUsers()
                          .then((data) => data.json())
                          .then((data) => {
                            dispatchUserUpdate(data);
                          })
                          .catch((err) => console.log(err));
                        return res;
                      })
                      .catch((err) => console.log(err));
                  }}
                >
                  Stop All
                </Button>
              </td>
              <td>
                {/* Shutdown Jupyterhub */}
                <Button
                  variant="danger"
                  className="shutdown-button"
                  onClick={shutdownHub}
                >
                  Shutdown Hub
                </Button>
              </td>
            </tr>
            {user_data.map((e, i) => (
              <tr key={i + "row"} className="user-row">
                <td>{e.name}</td>
                <td>{e.admin ? "admin" : ""}</td>
                <td>
                  {e.last_activity ? timeSince(e.last_activity) : "Never"}
                </td>
                <td>
                  {e.server != null ? (
                    // Stop Single-user server
                    <button
                      className="btn btn-danger btn-xs stop-button"
                      onClick={() =>
                        stopServer(e.name)
                          .then((res) => {
                            updateUsers()
                              .then((data) => data.json())
                              .then((data) => {
                                dispatchUserUpdate(data);
                              });
                            return res;
                          })
                          .catch((err) => console.log(err))
                      }
                    >
                      Stop Server
                    </button>
                  ) : (
                    // Start Single-user server
                    <button
                      className="btn btn-primary btn-xs start-button"
                      onClick={() =>
                        startServer(e.name)
                          .then((res) => {
                            updateUsers()
                              .then((data) => data.json())
                              .then((data) => {
                                dispatchUserUpdate(data);
                              });
                            return res;
                          })
                          .catch((err) => console.log(err))
                      }
                    >
                      Start Server
                    </button>
                  )}
                </td>
                <td>
                  {/* Edit User */}
                  <button
                    className="btn btn-primary btn-xs"
                    style={{ marginRight: 20 }}
                    onClick={() =>
                      history.push({
                        pathname: "/edit-user",
                        state: {
                          username: e.name,
                          has_admin: e.admin,
                        },
                      })
                    }
                  >
                    edit user
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

ServerDashboard.propTypes = {
  user_data: PropTypes.array,
  updateUsers: PropTypes.func,
  shutdownHub: PropTypes.func,
  startServer: PropTypes.func,
  stopServer: PropTypes.func,
  startAll: PropTypes.func,
  stopAll: PropTypes.func,
  dispatch: PropTypes.func,
  history: PropTypes.shape({
    push: PropTypes.func,
  }),
};

const SortHandler = (props) => {
  var { sorts, callback } = props;

  var [direction, setDirection] = useState(undefined);

  return (
    <div
      className="sort-icon"
      onClick={() => {
        if (!direction) {
          callback(sorts.desc);
          setDirection("desc");
        } else if (direction == "asc") {
          callback(sorts.desc);
          setDirection("desc");
        } else {
          callback(sorts.asc);
          setDirection("asc");
        }
      }}
    >
      {!direction ? (
        <FaSort />
      ) : direction == "asc" ? (
        <FaSortDown />
      ) : (
        <FaSortUp />
      )}
    </div>
  );
};

SortHandler.propTypes = {
  sorts: PropTypes.object,
  callback: PropTypes.func,
};

export default ServerDashboard;