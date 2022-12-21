const DepositList = (props) => {
  const component = props.deposits?.map((deposit) => (
    <div key={`deposit-${deposit.id}`}></div>
  ));
  return (
    <table className="screen__table">
      <thead className="screen__table-header">Deposit Records</thead>
      <tbody className="screen__table-rows deposit__list">{component}</tbody>
    </table>
  );
};

export default DepositList;
