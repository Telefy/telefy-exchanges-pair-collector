const axios = require("axios");
const mysql = require('mysql');
const pairs = [];
const dataInsert = [];
var con = mysql.createConnection({
  host: "testdev.rungila.com",
  user: "user1",
  password: "_kVvPeE(S!#[XE_85@",
  database: "arbitrage",
});


con.connect(function (err) {
  if (err) throw err;
   console.log("Connected!");
});




const init = async ()=> {
        await con.query(
          `SELECT * FROM m_exchanges where exchange_id !='3' ORDER by exchange_id ASC`,
          async (err, exresult) => {
            if (err) throw err;
            for(let exchange=0; exchange < exresult.length; exchange++){

                let waitLoop = new Promise(async (resolve,reject)=>{            

                    let otherExchanges = exresult.filter(function(element){            
                        return element.exchange_id !== exresult[exchange].exchange_id;
                    });

                    let parameter = {
                        baseExchange: exresult[exchange],
                        otherExchanges: otherExchanges 
                    } 

                    await getBaseExchangePair(parameter,resolve,reject);

                })

                await waitLoop;
                if(exchange == exresult.length -1){
                  if(pairs.length >=2){
                    checkCommonPairs()
                  }
                }
            } 
          }
        )
}

const getBaseExchangePair = async (values, nextLoop, loopReject) => {
  let getAllUrlConfig = {
    method: "GET",
    url: `http://localhost:5000/allPairs/${values.baseExchange.exchange_id}`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  axios(getAllUrlConfig).then(async (pairsResponse) => {
    if (pairsResponse.data.data.length > 0) {      
        pairs.push({[`${values.baseExchange.name}`]:pairsResponse.data.data,exchange: values.baseExchange.name,exchange_id : values.baseExchange.exchange_id,checked:[]})
        nextLoop(0)  
    } else {
      nextLoop(0);
    }
  });
};



const checkCommonPairs = async () => {
  for (let i = 0; i < pairs.length; i++) {
    let baseExchange = pairs[i].exchange;
    let baseExchangeId = pairs[i].exchange_id;
    let exchangePairs = pairs[i][baseExchange];
    let otherExchanges = pairs.filter(function (element) {
      return element.exchange !== baseExchange;
    });

      for (let j = 0; j < exchangePairs.length; j++) {
        let basePair = exchangePairs[j];

        for (let s = 0; s < otherExchanges.length; s++) {
          
          let otherExName = otherExchanges[s].exchange;
          let otherPairs = otherExchanges[s][otherExName];
          let otherExchangeId = otherExchanges[s].exchange_id;

            let [baseToken0, baseToken1, pairId, symbol] = await getObjectInfo(
              baseExchange,
              basePair
            );
  
            let [getIndex, otherPairId] = await getLoopIndex(
              baseToken0,
              baseToken1,
              otherExName,
              otherPairs
            );
  
            if (getIndex >= 0) {
              let deleteArray = otherPairs.splice(getIndex, 1);
  
              let post = `('${symbol}','${otherExchangeId}','${otherPairId}','${baseToken0}','${baseToken1}'),('${symbol}','${baseExchangeId}','${pairId}','${baseToken0}','${baseToken1}')`;
              dataInsert.push(post);
            } else {
              let [getIndexElse, otherPairIdElse] = await getLoopIndex(
                baseToken0,
                baseToken1,
                otherExName,
                otherPairs
              );
              if (getIndexElse >= 0) {
                let deleteArray = otherPairs.splice(getIndexElse, 1);
                let post = `('${symbol}','${otherExchangeId}','${otherPairIdElse}','${baseToken0}','${baseToken1}'),('${symbol}','${baseExchangeId}','${pairId}','${baseToken0}','${baseToken1}')`;
                dataInsert.push(post);
              }
            }
          
            if (i == pairs.length -1 && j == exchangePairs.length - 1 && s == otherExchanges.length -1) {
                if(dataInsert.length > 0){
                  var post = dataInsert.join();
                  var sql = `INSERT INTO m_common_pair (symbol,exchange_id,pairtoken,token0,token1) values ${post}`;
                  var query = con.query(sql, post, function (err, res) {
                    if (err) throw err;
                  });
                  console.log(query.sql)
                }
            }
        }
      }
    
    
  }
};


const getObjectInfo = async (exchange,exchangeData)=> {
  let token0;
  let token1;
  let pairId;
  let symbol;
  if(exchange == "UNISWAP"){
    token0 = exchangeData.token0.id
    token1 = exchangeData.token1.id
    pairId = exchangeData.id
    symbol = exchangeData.token0.symbol+"/"+exchangeData.token1.symbol;
  } else if(exchange == "SUSHISWAP") {
    token0 = exchangeData.token0.id
    token1 = exchangeData.token1.id
    pairId = exchangeData.id
    symbol = exchangeData.token0.symbol+"/"+exchangeData.token1.symbol;
  } else if(exchange == "BANCOR") {
    if(exchangeData.reserves.length >= 2){
      token0 = exchangeData.reserves[0].dlt_id;
      token1 = exchangeData.reserves[1].dlt_id;
      pairId = exchangeData.dlt_id;
      symbol = exchangeData.name;
    }
    
  } else if(exchange == "BALANCER") {
    token0 = exchangeData.token0.id
    token1 = exchangeData.token1.id
    pairId = exchangeData.id
    symbol = exchangeData.token0.symbol+"/"+exchangeData.token1.symbol;
  } 

  return [token0,token1,pairId,symbol]
}

const getLoopIndex = async (token0,token1,exchange,otherPairs) => {

  let index;
  let pairId;
  
  if(exchange == "UNISWAP"){
    index = otherPairs.findIndex((otherPair) => otherPair.token0.id === token0 && otherPair.token1.id === token1);
    if(index >= 0){      
      pairId = otherPairs[index].id
    }
  } else if(exchange == "SUSHISWAP") {
    index = otherPairs.findIndex((otherPair) => otherPair.token0.id === token0 && otherPair.token1.id === token1);
    if(index >= 0){
      pairId = otherPairs[index].id
    }
  } else if(exchange == "BANCOR") {
    index = otherPairs.findIndex((otherPair) => otherPair.reserves[0].dlt_id === token0 && otherPair.reserves[1].dlt_id === token1);
    if(index >= 0){
      pairId = otherPairs[index].dlt_id
    }
  } else if(exchange == "BALANCER") {
    index = otherPairs.findIndex((otherPair) => otherPair.token0.id === token0 && otherPair.token1.id === token1);
    pairId = otherPairs[index].id
  } 

  return [index,pairId]
}


init()