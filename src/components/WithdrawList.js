const WithdrawList = (props) => {
  const component = props.withdraws?.map((withdraw) => (
    <div key={`withdraw-${withdraw.id}`}></div>
  ));
  return (
    <table className="screen__table">
      <thead className="screen__table-header">Withdraw Records</thead>
      <tbody className="screen__table-rows withdraw__list">
        {component}
      </tbody>
    </table>
  );
};

export default WithdrawList;
